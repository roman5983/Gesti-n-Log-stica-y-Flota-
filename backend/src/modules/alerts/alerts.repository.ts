import { prisma } from '../../database/prisma-client';
import type { Alert, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

export interface AlertFilters {
  status?: 'PENDING' | 'RESOLVED';
  entityType?: string;
  alertType?: string;
}

interface PageArgs {
  skip: number;
  take: number;
}

function buildWhere(filters: AlertFilters): Prisma.AlertWhereInput {
  return {
    status: filters.status,
    entityType: filters.entityType,
    alertType: filters.alertType,
  };
}

export const alertsRepository = {
  findById(id: number): Promise<Alert | null> {
    return prisma.alert.findUnique({ where: { id } });
  },

  findMany(filters: AlertFilters, page: PageArgs): Promise<Alert[]> {
    return prisma.alert.findMany({
      where: buildWhere(filters),
      orderBy: [{ status: 'asc' }, { raisedAt: 'desc' }],
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: AlertFilters): Promise<number> {
    return prisma.alert.count({ where: buildWhere(filters) });
  },

  /** All currently PENDING alerts (evaluator reconciles against this set). */
  findPending(db: DbClient = prisma) {
    return db.alert.findMany({
      where: { status: 'PENDING' },
      select: { id: true, alertType: true, entityType: true, entityId: true },
    });
  },

  create(data: Prisma.AlertUncheckedCreateInput, db: DbClient = prisma): Promise<Alert> {
    return db.alert.create({ data });
  },

  resolve(id: number, resolvedById: number, db: DbClient = prisma): Promise<Alert> {
    return db.alert.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedById, resolvedAt: new Date() },
    });
  },
};
