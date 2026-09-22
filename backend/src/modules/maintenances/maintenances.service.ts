import { prisma } from '../../database/prisma-client';
import type { Prisma } from '../../generated/prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { toBytes, type StoredFile } from '../../shared/utils/files';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { vehiclesRepository } from '../vehicles/vehicles.repository';
import {
  maintenancesRepository,
  type MaintenanceFilters,
  type MaintenanceWithRelations,
} from './maintenances.repository';
import type {
  CreateMaintenanceDto,
  ListMaintenancesQuery,
  UpdateMaintenanceDto,
} from './maintenances.schemas';

export interface MaintenanceResponse {
  id: number;
  vehicle: { id: number; licensePlate: string; model: string };
  maintenanceType: { id: number; name: string };
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledAt: Date;
  completedAt: Date | null;
  km: number;
  notes: string | null;
  nextMaintenanceKm: number | null;
  attachments: {
    id: number;
    fileName: string;
    mimeType: string;
    fileSize: number;
    uploadedAt: Date;
  }[];
}

function toResponse(m: MaintenanceWithRelations): MaintenanceResponse {
  return {
    id: m.id,
    vehicle: m.vehicle,
    maintenanceType: m.maintenanceType,
    status: m.status,
    scheduledAt: m.scheduledAt,
    completedAt: m.completedAt,
    km: m.km,
    notes: m.notes,
    nextMaintenanceKm: m.nextMaintenanceKm,
    attachments: m.attachments.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      fileSize: a.fileSize,
      uploadedAt: a.uploadedAt,
    })),
  };
}

function toAuditSnapshot(m: MaintenanceWithRelations) {
  return {
    vehicleId: m.vehicleId,
    maintenanceTypeId: m.maintenanceTypeId,
    status: m.status,
    scheduledAt: m.scheduledAt,
    km: m.km,
  };
}

async function getExistingOrFail(id: number): Promise<MaintenanceWithRelations> {
  const maintenance = await maintenancesRepository.findById(id);
  if (!maintenance) throw new NotFoundError(`No se encontró el mantenimiento ${id}`);
  return maintenance;
}

/**
 * Locks the maintenance row and returns a fresh copy read under that lock.
 * Every state transition decides from this copy, never from a read taken
 * before the transaction, so concurrent transitions serialize instead of
 * racing (see maintenancesRepository.lockMaintenance).
 */
async function lockAndReload(
  id: number,
  tx: Prisma.TransactionClient,
): Promise<MaintenanceWithRelations> {
  await maintenancesRepository.lockMaintenance(id, tx);
  const maintenance = await maintenancesRepository.findById(id, tx);
  if (!maintenance) throw new NotFoundError(`No se encontró el mantenimiento ${id}`);
  return maintenance;
}

export const maintenancesService = {
  async list(query: ListMaintenancesQuery): Promise<PaginatedResult<MaintenanceResponse>> {
    const filters: MaintenanceFilters = {
      vehicleId: query.vehicleId,
      status: query.status,
      view: query.view,
    };
    const [items, total] = await Promise.all([
      maintenancesRepository.findMany(filters, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      maintenancesRepository.count(filters),
    ]);
    return { items: items.map(toResponse), total };
  },

  async getById(id: number): Promise<MaintenanceResponse> {
    return toResponse(await getExistingOrFail(id));
  },

  /** Register (schedule) a maintenance: it is born PENDING (C-6). */
  async create(dto: CreateMaintenanceDto, actorId: number): Promise<MaintenanceResponse> {
    const vehicle = await vehiclesRepository.findById(dto.vehicleId);
    if (!vehicle) throw new NotFoundError(`No se encontró el vehículo ${dto.vehicleId}`);

    const type = await prisma.maintenanceType.findUnique({
      where: { id: dto.maintenanceTypeId },
      select: { id: true },
    });
    if (!type) throw new NotFoundError(`No se encontró el tipo de mantenimiento ${dto.maintenanceTypeId}`);

    const created = await prisma.$transaction(async (tx) => {
      // Lock the vehicle row, then check for an open maintenance INSIDE the
      // transaction: two concurrent creates for the same vehicle serialize
      // here, so at most one open maintenance can exist (no DB UNIQUE backs
      // this rule, unlike email/plate).
      await maintenancesRepository.lockVehicle(dto.vehicleId, tx);
      if (await maintenancesRepository.hasOpenForVehicle(dto.vehicleId, undefined, tx)) {
        throw new ConflictError('Este vehículo ya tiene un mantenimiento abierto');
      }
      const maintenance = await maintenancesRepository.create(
        {
          vehicleId: dto.vehicleId,
          maintenanceTypeId: dto.maintenanceTypeId,
          scheduledAt: dto.scheduledAt,
          km: dto.km,
          notes: dto.notes,
          nextMaintenanceKm: dto.nextMaintenanceKm,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'CREATE',
          entity: 'MAINTENANCE',
          entityId: maintenance.id,
          newData: toAuditSnapshot(maintenance),
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(created);
  },

  async update(id: number, dto: UpdateMaintenanceDto, actorId: number): Promise<MaintenanceResponse> {
    const existing = await getExistingOrFail(id);
    // RN-22: a completed maintenance is immutable (it belongs to history).
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new BusinessRuleError('Un mantenimiento finalizado o cancelado no se puede editar');
    }
    if (dto.maintenanceTypeId && dto.maintenanceTypeId !== existing.maintenanceTypeId) {
      const type = await prisma.maintenanceType.findUnique({
        where: { id: dto.maintenanceTypeId },
        select: { id: true },
      });
      if (!type) throw new NotFoundError(`No se encontró el tipo de mantenimiento ${dto.maintenanceTypeId}`);
    }
    // Cross-field invariant against effective values: the schema only sees
    // fields present in this request, so a partial edit (only km, or only
    // nextMaintenanceKm) is re-checked here against the stored record.
    const effectiveKm = dto.km ?? existing.km;
    const effectiveNextKm =
      dto.nextMaintenanceKm !== undefined ? dto.nextMaintenanceKm : existing.nextMaintenanceKm;
    if (effectiveNextKm !== null && effectiveNextKm < effectiveKm) {
      throw new BusinessRuleError('El km del próximo mantenimiento debe ser mayor o igual al km actual');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const maintenance = await maintenancesRepository.update(
        id,
        {
          maintenanceType: dto.maintenanceTypeId
            ? { connect: { id: dto.maintenanceTypeId } }
            : undefined,
          scheduledAt: dto.scheduledAt,
          km: dto.km,
          notes: dto.notes,
          nextMaintenanceKm: dto.nextMaintenanceKm,
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: toAuditSnapshot(existing),
          newData: toAuditSnapshot(maintenance),
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * PENDING → IN_PROGRESS. Effect: vehicle AVAILABLE → IN_WORKSHOP (F-6).
   * The vehicle must be AVAILABLE — a unit on a trip or already inactive
   * cannot enter the workshop.
   *
   * Both rows are locked (maintenance, then vehicle) and re-read before the
   * checks: the maintenance lock serializes against a concurrent cancel or
   * double start; the vehicle lock against a trip assignment grabbing the
   * same unit (assign locks vehicles FOR UPDATE SKIP LOCKED).
   */
  async start(id: number, actorId: number): Promise<MaintenanceResponse> {
    await getExistingOrFail(id);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await lockAndReload(id, tx);
      if (existing.status !== 'PENDING') {
        throw new BusinessRuleError('Solo se pueden iniciar mantenimientos pendientes');
      }
      await maintenancesRepository.lockVehicle(existing.vehicleId, tx);
      const vehicle = await vehiclesRepository.findById(existing.vehicleId, tx);
      if (!vehicle) throw new NotFoundError(`No se encontró el vehículo ${existing.vehicleId}`);
      if (vehicle.status !== 'AVAILABLE') {
        throw new BusinessRuleError(
          'El vehículo debe estar disponible para iniciar el mantenimiento',
        );
      }

      const maintenance = await maintenancesRepository.update(id, { status: 'IN_PROGRESS' }, tx);
      await vehiclesRepository.update(existing.vehicleId, { status: 'IN_WORKSHOP' }, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: { status: 'PENDING' },
          newData: { status: 'IN_PROGRESS', vehicleStatus: 'IN_WORKSHOP' },
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * IN_PROGRESS → COMPLETED. Effects (RN-9, F-6): vehicle IN_WORKSHOP →
   * AVAILABLE, lastMaintenanceDate updated, maintenance moves to history.
   * Locked and re-read so a concurrent cancel cannot also apply its effects.
   */
  async complete(id: number, actorId: number): Promise<MaintenanceResponse> {
    await getExistingOrFail(id);

    const now = new Date();
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await lockAndReload(id, tx);
      if (existing.status !== 'IN_PROGRESS') {
        throw new BusinessRuleError('Solo se pueden finalizar mantenimientos en curso');
      }

      const maintenance = await maintenancesRepository.update(
        id,
        { status: 'COMPLETED', completedAt: now },
        tx,
      );
      // RN-9: completing the maintenance unblocks the vehicle.
      await vehiclesRepository.update(
        existing.vehicleId,
        { status: 'AVAILABLE', lastMaintenanceDate: now },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'FINISH',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: { status: 'IN_PROGRESS' },
          newData: { status: 'COMPLETED', vehicleStatus: 'AVAILABLE' },
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * PENDING/IN_PROGRESS → CANCELLED (F-2). Cancelling one that is IN_PROGRESS
   * releases the vehicle (IN_WORKSHOP → AVAILABLE) without touching
   * lastMaintenanceDate: the work was not done. The row is locked and re-read
   * first: deciding whether to release the vehicle from a stale PENDING read
   * is exactly what would strand it IN_WORKSHOP after a concurrent start.
   */
  async cancel(id: number, actorId: number): Promise<MaintenanceResponse> {
    await getExistingOrFail(id);
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await lockAndReload(id, tx);
      if (existing.status !== 'PENDING' && existing.status !== 'IN_PROGRESS') {
        throw new BusinessRuleError('Solo se pueden cancelar mantenimientos pendientes o en curso');
      }
      const maintenance = await maintenancesRepository.update(id, { status: 'CANCELLED' }, tx);
      const releasesVehicle = existing.status === 'IN_PROGRESS';
      if (releasesVehicle) {
        await vehiclesRepository.update(existing.vehicleId, { status: 'AVAILABLE' }, tx);
      }
      await auditLogsService.record(
        {
          actorId,
          action: 'CANCEL',
          entity: 'MAINTENANCE',
          entityId: id,
          previousData: { status: existing.status },
          newData: { status: 'CANCELLED', ...(releasesVehicle ? { vehicleStatus: 'AVAILABLE' } : {}) },
        },
        tx,
      );
      return maintenance;
    });
    return toResponse(updated);
  },

  /**
   * Attach a receipt (F-9). The upload is validated in memory (size/MIME);
   * here we store it — bytes and metadata in the same row — together with
   * the audit entry, in one transaction.
   *
   * Intentionally allowed even when the maintenance is COMPLETED: RN-22
   * protects the maintenance RECORD (km, dates, type, status), not its
   * supporting documentation. A receipt is additive evidence — the invoice
   * usually arrives after the work is closed — not a mutation of history.
   * Attachments are append-only: they can be added but never edited or
   * deleted (no delete/replace endpoint exists). If one is ever added, it
   * must be restricted, to preserve the historical integrity of the record.
   */
  async addAttachment(
    id: number,
    file: Express.Multer.File,
    actorId: number,
  ): Promise<MaintenanceResponse> {
    const existing = await getExistingOrFail(id);
    await prisma.$transaction(async (tx) => {
      await maintenancesRepository.addAttachment(
        {
          maintenanceId: existing.id,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          content: toBytes(file.buffer),
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'MAINTENANCE',
          entityId: id,
          newData: { attachmentAdded: file.originalname },
        },
        tx,
      );
    });
    return toResponse((await maintenancesRepository.findById(id))!);
  },

  /**
   * Resolve an attachment for download (bytes, original name, MIME type).
   * Scoped to the maintenance so an attachment id from another record
   * cannot be fetched through this maintenance.
   */
  async getAttachment(
    maintenanceId: number,
    attachmentId: number,
  ): Promise<StoredFile> {
    const attachment = await maintenancesRepository.findAttachment(attachmentId, maintenanceId);
    if (!attachment) {
      throw new NotFoundError(
        `No se encontró el adjunto ${attachmentId} del mantenimiento ${maintenanceId}`,
      );
    }
    if (!attachment.content) throw new NotFoundError('El archivo ya no está disponible');
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      content: attachment.content,
    };
  },
};
