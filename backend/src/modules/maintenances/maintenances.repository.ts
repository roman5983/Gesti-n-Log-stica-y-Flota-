import { prisma } from '../../database/prisma-client';
import type { MaintenanceStatus, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

const maintenanceInclude = {
  vehicle: { select: { id: true, licensePlate: true, model: true } },
  maintenanceType: { select: { id: true, name: true } },
  attachments: true,
} satisfies Prisma.MaintenanceInclude;

export type MaintenanceWithRelations = Prisma.MaintenanceGetPayload<{
  include: typeof maintenanceInclude;
}>;

export interface MaintenanceFilters {
  vehicleId?: number;
  status?: MaintenanceStatus;
  /** C-6: 'scheduled' → PENDING+IN_PROGRESS, 'history' → COMPLETED. */
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
    where.status = 'COMPLETED';
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

  create(data: Prisma.MaintenanceUncheckedCreateInput, db: DbClient = prisma) {
    return db.maintenance.create({ data, include: maintenanceInclude });
  },

  update(id: number, data: Prisma.MaintenanceUpdateInput, db: DbClient = prisma) {
    return db.maintenance.update({ where: { id }, data, include: maintenanceInclude });
  },

  addAttachment(data: Prisma.MaintenanceAttachmentUncheckedCreateInput, db: DbClient = prisma) {
    return db.maintenanceAttachment.create({ data });
  },

  findAttachment(attachmentId: number, maintenanceId: number) {
    return prisma.maintenanceAttachment.findFirst({
      where: { id: attachmentId, maintenanceId },
    });
  },
};
