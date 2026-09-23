import { prisma } from '../../database/prisma-client';
import type { MaintenanceStatus, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';
import type { SortOrder } from '../../shared/schemas';
import { utcEndOfDay } from '../../shared/utils/dates';
import type { MaintenanceSortField } from './maintenances.schemas';

const maintenanceInclude = {
  vehicle: { select: { id: true, licensePlate: true, model: true } },
  maintenanceType: { select: { id: true, name: true } },
  // Attachment metadata only: the file bytes are read by findAttachment alone.
  attachments: { omit: { content: true } },
} satisfies Prisma.MaintenanceInclude;

export type MaintenanceWithRelations = Prisma.MaintenanceGetPayload<{
  include: typeof maintenanceInclude;
}>;

export interface MaintenanceFilters {
  vehicleId?: number;
  status?: MaintenanceStatus;
  /** C-6: 'scheduled' → PENDING+IN_PROGRESS, 'history' → COMPLETED+CANCELLED. */
  view?: 'scheduled' | 'history';
  maintenanceTypeId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface MaintenanceSort {
  field: MaintenanceSortField;
  order: SortOrder;
}

interface PageArgs {
  skip: number;
  take: number;
}

/** Exported for unit tests. */
export function buildMaintenanceWhere(filters: MaintenanceFilters): Prisma.MaintenanceWhereInput {
  const where: Prisma.MaintenanceWhereInput = {
    vehicleId: filters.vehicleId,
    maintenanceTypeId: filters.maintenanceTypeId,
  };
  if (filters.dateFrom || filters.dateTo) {
    where.scheduledAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: utcEndOfDay(filters.dateTo) } : {}),
    };
  }
  if (filters.status) {
    where.status = filters.status;
  } else if (filters.view === 'scheduled') {
    where.status = { in: ['PENDING', 'IN_PROGRESS'] };
  } else if (filters.view === 'history') {
    where.status = { in: ['COMPLETED', 'CANCELLED'] };
  }
  return where;
}

/**
 * ORDER BY for the sort control. Type and vehicle sort by their visible name
 * (type name, license plate), not by id. Every order ends in the scheduled
 * date and the id, so rows with equal keys keep a stable order across pages —
 * without a unique tiebreaker, paginating could repeat or skip rows.
 * Exported for unit tests.
 */
export function buildMaintenanceOrderBy(sort: MaintenanceSort): Prisma.MaintenanceOrderByWithRelationInput[] {
  const { field, order } = sort;
  const primary: Prisma.MaintenanceOrderByWithRelationInput = (() => {
    switch (field) {
      case 'type':
        return { maintenanceType: { name: order } };
      case 'vehicle':
        return { vehicle: { licensePlate: order } };
      case 'km':
        return { km: order };
      case 'completedAt':
        // Not-yet-completed rows (NULL) go last in either direction.
        return { completedAt: { sort: order, nulls: 'last' } };
      case 'scheduledAt':
        return { scheduledAt: order };
    }
  })();
  const tail: Prisma.MaintenanceOrderByWithRelationInput[] =
    field === 'scheduledAt' ? [{ id: order }] : [{ scheduledAt: 'desc' }, { id: 'desc' }];
  return [primary, ...tail];
}

export const maintenancesRepository = {
  findById(id: number, db: DbClient = prisma): Promise<MaintenanceWithRelations | null> {
    return db.maintenance.findUnique({ where: { id }, include: maintenanceInclude });
  },

  findMany(
    filters: MaintenanceFilters,
    page: PageArgs,
    sort: MaintenanceSort = { field: 'scheduledAt', order: 'desc' },
  ): Promise<MaintenanceWithRelations[]> {
    return prisma.maintenance.findMany({
      where: buildMaintenanceWhere(filters),
      include: maintenanceInclude,
      orderBy: buildMaintenanceOrderBy(sort),
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: MaintenanceFilters): Promise<number> {
    return prisma.maintenance.count({ where: buildMaintenanceWhere(filters) });
  },

  /** True if the vehicle already has an open (non-completed) maintenance. */
  async hasOpenForVehicle(
    vehicleId: number,
    excludeId?: number,
    db: DbClient = prisma,
  ): Promise<boolean> {
    const open = await db.maintenance.findFirst({
      where: {
        vehicleId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return open !== null;
  },

  /**
   * Row-lock the vehicle inside a transaction (SELECT ... FOR UPDATE) to
   * serialize concurrent maintenance creation for the same vehicle: without
   * a DB-level UNIQUE, this is what prevents two open maintenances racing in.
   */
  async lockVehicle(vehicleId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM vehicles WHERE id = ${vehicleId} FOR UPDATE`;
  },

  /**
   * Row-lock the maintenance inside a transaction to serialize its state
   * transitions (start / complete / cancel). A plain read inside a transaction
   * does NOT lock in InnoDB, so without this two operators acting at once can
   * both see PENDING — e.g. a start and a cancel both succeed and the vehicle
   * is left IN_WORKSHOP with its maintenance CANCELLED, with no way out from
   * the app. Callers must re-read the row after taking the lock.
   */
  async lockMaintenance(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM maintenances WHERE id = ${id} FOR UPDATE`;
  },

  create(data: Prisma.MaintenanceUncheckedCreateInput, db: DbClient = prisma) {
    return db.maintenance.create({ data, include: maintenanceInclude });
  },

  update(id: number, data: Prisma.MaintenanceUpdateInput, db: DbClient = prisma) {
    return db.maintenance.update({ where: { id }, data, include: maintenanceInclude });
  },

  addAttachment(data: Prisma.MaintenanceAttachmentUncheckedCreateInput, db: DbClient = prisma) {
    return db.maintenanceAttachment.create({ data, select: { id: true } });
  },

  /** The file itself, for download. Null content = uploaded before files moved into the DB. */
  findAttachment(attachmentId: number, maintenanceId: number) {
    return prisma.maintenanceAttachment.findFirst({
      where: { id: attachmentId, maintenanceId },
      select: { fileName: true, mimeType: true, content: true },
    });
  },
};
