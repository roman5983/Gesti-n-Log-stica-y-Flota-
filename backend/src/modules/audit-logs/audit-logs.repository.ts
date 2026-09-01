import { prisma } from '../../database/prisma-client';
import type { Prisma } from '../../generated/prisma/client';
import { utcEndOfDay } from '../../shared/utils/dates';

/** Either the global client or a transaction client — repositories accept both. */
export type DbClient = typeof prisma | Prisma.TransactionClient;

interface CreateAuditLogData {
  userId: number;
  action: string;
  entity: string;
  entityId?: number;
  previousData?: Prisma.InputJsonValue;
  newData?: Prisma.InputJsonValue;
}

export interface AuditLogFilters {
  userId?: number;
  entity?: string;
  action?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

interface PageArgs {
  skip: number;
  take: number;
}

function buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {
    userId: filters.userId,
    entity: filters.entity,
    action: filters.action,
  };
  if (filters.dateFrom || filters.dateTo) {
    // utcEndOfDay makes dateTo an inclusive upper bound (same timezone
    // semantics as reports); a raw lte would drop the last day of the range.
    where.occurredAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: utcEndOfDay(filters.dateTo) } : {}),
    };
  }
  return where;
}

/**
 * Audit persistence (RN-7). Only INSERT and SELECT are exposed — never
 * update/delete (A-5): the trail is immutable from the application.
 */
export const auditLogsRepository = {
  create(data: CreateAuditLogData, db: DbClient = prisma) {
    return db.auditLog.create({ data });
  },

  findMany(filters: AuditLogFilters, page: PageArgs) {
    return prisma.auditLog.findMany({
      where: buildWhere(filters),
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { occurredAt: 'desc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: AuditLogFilters): Promise<number> {
    return prisma.auditLog.count({ where: buildWhere(filters) });
  },
};
