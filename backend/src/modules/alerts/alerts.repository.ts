import { prisma } from '../../database/prisma-client';
import type { Alert, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';
import type { SortOrder } from '../../shared/schemas';
import { utcEndOfDay } from '../../shared/utils/dates';
import type { AlertSortField } from './alerts.schemas';

export interface AlertFilters {
  status?: 'PENDING' | 'RESOLVED';
  entityType?: string;
  alertType?: string;
  vehicleId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AlertSort {
  field?: AlertSortField;
  order: SortOrder;
}

interface PageArgs {
  skip: number;
  take: number;
}

/** Exported for unit tests. */
export function buildAlertWhere(filters: AlertFilters): Prisma.AlertWhereInput {
  const where: Prisma.AlertWhereInput = {
    status: filters.status,
    entityType: filters.entityType,
    alertType: filters.alertType,
  };
  // Alerts point at their entity polymorphically (entityType + entityId), so
  // "alerts of vehicle X" is that pair — it also narrows entityType.
  if (filters.vehicleId) {
    where.entityType = 'VEHICLE';
    where.entityId = filters.vehicleId;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.raisedAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: utcEndOfDay(filters.dateTo) } : {}),
    };
  }
  return where;
}

/**
 * ORDER BY for the sort control; ends in the id so equal keys keep a stable
 * order across pages. Without an explicit field it keeps the inbox order:
 * pending first, newest first. Exported for unit tests.
 */
export function buildAlertOrderBy(sort: AlertSort): Prisma.AlertOrderByWithRelationInput[] {
  switch (sort.field) {
    case 'raisedAt':
      return [{ raisedAt: sort.order }, { id: sort.order }];
    case 'alertType':
      return [{ alertType: sort.order }, { raisedAt: 'desc' }, { id: 'desc' }];
    default:
      return [{ status: 'asc' }, { raisedAt: 'desc' }, { id: 'desc' }];
  }
}

export const alertsRepository = {
  findById(id: number): Promise<Alert | null> {
    return prisma.alert.findUnique({ where: { id } });
  },

  findMany(filters: AlertFilters, page: PageArgs, sort: AlertSort = { order: 'desc' }): Promise<Alert[]> {
    return prisma.alert.findMany({
      where: buildAlertWhere(filters),
      orderBy: buildAlertOrderBy(sort),
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: AlertFilters): Promise<number> {
    return prisma.alert.count({ where: buildAlertWhere(filters) });
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
