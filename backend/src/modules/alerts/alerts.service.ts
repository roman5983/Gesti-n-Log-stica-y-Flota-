import { prisma } from '../../database/prisma-client';
import type { Alert } from '../../generated/prisma/client';
import { EXPIRY_ALERT_LEAD_DAYS } from '../../config/constants';
import { ConflictError, NotFoundError, BusinessRuleError } from '../../shared/errors/app-error';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { DbClient } from '../audit-logs/audit-logs.repository';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { alertsRepository, type AlertFilters } from './alerts.repository';
import type { ListAlertsQuery } from './alerts.schemas';

/** Named advisory lock that serializes the evaluation (MySQL GET_LOCK). */
const EVALUATE_LOCK = 'logistics_alerts_evaluate';

/** Stable identity of an alert condition, for reconciliation. */
function conditionKey(c: { alertType: string; entityType: string; entityId: number }): string {
  return `${c.alertType}::${c.entityType}::${c.entityId}`;
}

export interface AlertResponse {
  id: number;
  alertType: string;
  description: string;
  entityType: string;
  entityId: number;
  status: string;
  raisedAt: Date;
  resolvedById: number | null;
  resolvedAt: Date | null;
}

function toResponse(a: Alert): AlertResponse {
  return {
    id: a.id,
    alertType: a.alertType,
    description: a.description,
    entityType: a.entityType,
    entityId: a.entityId,
    status: a.status,
    raisedAt: a.raisedAt,
    resolvedById: a.resolvedById,
    resolvedAt: a.resolvedAt,
  };
}

/** A condition detected by the scanner, before idempotency filtering. */
interface Candidate {
  alertType: string;
  entityType: string;
  entityId: number;
  description: string;
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Scan every expiry/threshold condition and return the alerts that should
 * exist. Pure reads; no writes. "Expiring" means due within
 * EXPIRY_ALERT_LEAD_DAYS (A-12: two weeks); "expired" means already past.
 */
async function scanConditions(db: DbClient): Promise<Candidate[]> {
  const today = utcStartOfToday();
  const soon = addDaysUtc(today, EXPIRY_ALERT_LEAD_DAYS);
  const candidates: Candidate[] = [];

  // --- Driver licenses (RN-1 / A-12) ---
  const drivers = await db.driver.findMany({
    where: { user: { deletedAt: null, isActive: true } },
    select: { userId: true, licenseExpiryDate: true, user: { select: { name: true } } },
  });
  for (const d of drivers) {
    if (d.licenseExpiryDate < today) {
      candidates.push({
        alertType: 'LICENSE_EXPIRED',
        entityType: 'DRIVER',
        entityId: d.userId,
        description: `License of driver ${d.user.name} is expired`,
      });
    } else if (d.licenseExpiryDate <= soon) {
      candidates.push({
        alertType: 'LICENSE_EXPIRING',
        entityType: 'DRIVER',
        entityId: d.userId,
        description: `License of driver ${d.user.name} expires within ${EXPIRY_ALERT_LEAD_DAYS} days`,
      });
    }
  }

  // --- Driver documents (RN-4 / A-12) ---
  // Filter by the driver too (active, non-deleted) — same criterion as the
  // license scan; a deactivated or soft-deleted driver must not raise
  // document alerts.
  const documents = await db.driverDocument.findMany({
    where: { deletedAt: null, driver: { user: { deletedAt: null, isActive: true } } },
    select: { id: true, documentType: true, expiryDate: true },
  });
  for (const doc of documents) {
    if (doc.expiryDate < today) {
      candidates.push({
        alertType: 'DOCUMENT_EXPIRED',
        entityType: 'DRIVER_DOCUMENT',
        entityId: doc.id,
        description: `${doc.documentType} document is expired`,
      });
    } else if (doc.expiryDate <= soon) {
      candidates.push({
        alertType: 'DOCUMENT_EXPIRING',
        entityType: 'DRIVER_DOCUMENT',
        entityId: doc.id,
        description: `${doc.documentType} document expires within ${EXPIRY_ALERT_LEAD_DAYS} days`,
      });
    }
  }

  // --- Vehicles: insurance, inactivity, maintenance km ---
  const vehicles = await db.vehicle.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      licensePlate: true,
      status: true,
      accumulatedKm: true,
      initialKm: true,
      insuranceExpiryDate: true,
    },
  });

  // Lowest km_alert in the catalog implements the maintenance threshold (RN-3).
  const minType = await db.maintenanceType.aggregate({ _min: { kmAlert: true } });
  const kmAlertThreshold = minType._min.kmAlert;

  // Baseline km per vehicle = km of its last COMPLETED maintenance (fallback:
  // initialKm). Fetched in one query and reduced in memory to avoid N+1.
  const completed = await db.maintenance.findMany({
    where: { status: 'COMPLETED' },
    select: { vehicleId: true, km: true },
    orderBy: { km: 'desc' },
  });
  const lastMaintenanceKm = new Map<number, number>();
  for (const m of completed) {
    if (!lastMaintenanceKm.has(m.vehicleId)) lastMaintenanceKm.set(m.vehicleId, m.km);
  }

  for (const v of vehicles) {
    if (v.insuranceExpiryDate) {
      if (v.insuranceExpiryDate < today) {
        candidates.push({
          alertType: 'INSURANCE_EXPIRED',
          entityType: 'VEHICLE',
          entityId: v.id,
          description: `Insurance of vehicle ${v.licensePlate} is expired`,
        });
      } else if (v.insuranceExpiryDate <= soon) {
        candidates.push({
          alertType: 'INSURANCE_EXPIRING',
          entityType: 'VEHICLE',
          entityId: v.id,
          description: `Insurance of vehicle ${v.licensePlate} expires within ${EXPIRY_ALERT_LEAD_DAYS} days`,
        });
      }
    }

    if (v.status === 'INACTIVE') {
      candidates.push({
        alertType: 'VEHICLE_INACTIVE',
        entityType: 'VEHICLE',
        entityId: v.id,
        description: `Vehicle ${v.licensePlate} is inactive`,
      });
    }

    // RN-3: km since the last maintenance exceeds the catalog threshold.
    // Skipped for INACTIVE and IN_WORKSHOP vehicles: the former isn't in
    // service, the latter is already being serviced — alerting would be
    // redundant.
    if (kmAlertThreshold !== null && v.status !== 'INACTIVE' && v.status !== 'IN_WORKSHOP') {
      const baseline = lastMaintenanceKm.get(v.id) ?? v.initialKm;
      if (v.accumulatedKm - baseline >= kmAlertThreshold) {
        candidates.push({
          alertType: 'MAINTENANCE_KM_EXCEEDED',
          entityType: 'VEHICLE',
          entityId: v.id,
          description: `Vehicle ${v.licensePlate} exceeded the maintenance km threshold`,
        });
      }
    }
  }

  return candidates;
}

export const alertsService = {
  async list(query: ListAlertsQuery): Promise<PaginatedResult<AlertResponse>> {
    const filters: AlertFilters = {
      status: query.status,
      entityType: query.entityType,
      alertType: query.alertType,
    };
    const [alerts, total] = await Promise.all([
      alertsRepository.findMany(filters, { skip: (query.page - 1) * query.limit, take: query.limit }),
      alertsRepository.count(filters),
    ]);
    return { items: alerts.map(toResponse), total };
  },

  /**
   * Evaluate all conditions and reconcile the PENDING alerts (F-8):
   *  - create alerts for conditions that don't have a PENDING one yet;
   *  - auto-resolve PENDING alerts whose condition no longer holds (so a
   *    renewed license or a serviced vehicle clears its alert on its own,
   *    and persistent conditions like VEHICLE_INACTIVE disappear once fixed).
   *
   * The whole scan+reconcile runs inside a transaction guarded by a MySQL
   * advisory lock (GET_LOCK), so two concurrent evaluations (or a double
   * click) can't race in duplicate alerts — there is no DB unique to lean on
   * (MySQL has no partial unique index filtered by status).
   */
  async evaluate(
    actorId: number,
  ): Promise<{ evaluated: number; created: number; autoResolved: number }> {
    return prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<{ locked: number | bigint | null }[]>`
          SELECT GET_LOCK(${EVALUATE_LOCK}, 10) AS locked
        `;
        if (Number(rows[0]?.locked ?? 0) !== 1) {
          throw new ConflictError('Another evaluation is already in progress');
        }

        try {
          const candidates = await scanConditions(tx);
          const candidateKeys = new Set(candidates.map(conditionKey));
          const pending = await alertsRepository.findPending(tx);
          const pendingKeys = new Set(pending.map(conditionKey));

          let created = 0;
          for (const c of candidates) {
            if (pendingKeys.has(conditionKey(c))) continue;
            await alertsRepository.create(
              {
                alertType: c.alertType,
                entityType: c.entityType,
                entityId: c.entityId,
                description: c.description,
              },
              tx,
            );
            created += 1;
          }

          let autoResolved = 0;
          for (const p of pending) {
            if (candidateKeys.has(conditionKey(p))) continue;
            await alertsRepository.resolve(p.id, actorId, tx);
            autoResolved += 1;
          }

          if (created > 0 || autoResolved > 0) {
            await auditLogsService.record(
              {
                actorId,
                action: 'UPDATE',
                entity: 'ALERT',
                newData: { evaluated: candidates.length, created, autoResolved },
              },
              tx,
            );
          }
          return { evaluated: candidates.length, created, autoResolved };
        } finally {
          await tx.$queryRaw`SELECT RELEASE_LOCK(${EVALUATE_LOCK})`;
        }
      },
      { timeout: 15000 },
    );
  },

  /** Mark a pending alert as resolved (Admin). Idempotent guard on state. */
  async resolve(id: number, actorId: number): Promise<AlertResponse> {
    const existing = await alertsRepository.findById(id);
    if (!existing) throw new NotFoundError(`Alert ${id} not found`);
    if (existing.status === 'RESOLVED') {
      throw new BusinessRuleError('Alert is already resolved');
    }

    const resolved = await prisma.$transaction(async (tx) => {
      const alert = await alertsRepository.resolve(id, actorId, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'RESOLVE',
          entity: 'ALERT',
          entityId: id,
          previousData: { status: 'PENDING', alertType: existing.alertType },
          newData: { status: 'RESOLVED' },
        },
        tx,
      );
      return alert;
    });
    return toResponse(resolved);
  },
};
