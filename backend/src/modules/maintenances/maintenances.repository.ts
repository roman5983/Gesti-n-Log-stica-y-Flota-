import { prisma } from '../../database/prisma-client';
import type { MaintenanceStatus, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

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
}

interface PageArgs {
  skip: number;
  take: number;
}

function buildWhere(filters: MaintenanceFilters): Prisma.MaintenanceWhereInput {
  const where: Prisma.MaintenanceWhereInput = { vehicleId: filters.vehicleId };
  if (filters.status) {
    where.status = filters.status;
  } else if (filters.view === 'scheduled') {
    where.status = { in: ['PENDING', 'IN_PROGRESS'] };
  } else if (filters.view === 'history') {
    where.status = { in: ['COMPLETED', 'CANCELLED'] };
  }
  return where;
}

export const maintenancesRepository = {
  findById(id: number, db: DbClient = prisma): Promise<MaintenanceWithRelations | null> {
    return db.maintenance.findUnique({ where: { id }, include: maintenanceInclude });
  },

  findMany(filters: MaintenanceFilters, page: PageArgs): Promise<MaintenanceWithRelations[]> {
    return prisma.maintenance.findMany({
      where: buildWhere(filters),
      include: maintenanceInclude,
      orderBy: { scheduledAt: 'desc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: MaintenanceFilters): Promise<number> {
    return prisma.maintenance.count({ where: buildWhere(filters) });
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
