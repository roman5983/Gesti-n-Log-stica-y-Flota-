import type { Prisma } from '../../generated/prisma/client';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsRepository, type AuditLogFilters, type DbClient } from './audit-logs.repository';
import type { ListAuditLogsQuery } from './audit-logs.schemas';

/** Audit actions vocabulary — grows as modules are added. */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ACTIVATE'
  | 'DEACTIVATE'
  | 'ASSIGN'
  | 'FINISH'
  | 'RESOLVE'
  /** Security-sensitive read: an Admin viewed a driver's password (A-9). */
  | 'VIEW_CREDENTIALS';

export type AuditEntity =
  | 'USER'
  | 'DRIVER'
  | 'VEHICLE'
  | 'MAINTENANCE_TYPE'
  | 'MAINTENANCE'
  | 'DRIVER_DOCUMENT'
  | 'TRIP'
  | 'ALERT'
  | 'COMPANY_SETTINGS';

interface RecordAuditParams {
  /** Who performed the action (authenticated user id). */
  actorId: number;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: number;
  previousData?: unknown;
  newData?: unknown;
}

/** Credentials must never reach the audit trail, even for Admin eyes. */
const SENSITIVE_FIELDS = new Set(['passwordHash', 'encryptedPassword', 'tokenHash']);

function sanitize(data: unknown): Prisma.InputJsonValue | undefined {
  if (data === undefined || data === null) return undefined;
  const plain = JSON.parse(JSON.stringify(data)) as unknown; // strips Dates/Decimals to JSON-safe values
  if (typeof plain !== 'object' || plain === null) return plain as Prisma.InputJsonValue;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(plain as Record<string, unknown>)) {
    result[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
  }
  return result as Prisma.InputJsonValue;
}

/**
 * Domain service invoked BY other services inside their transactions (RN-7):
 * the audit entry commits or rolls back together with the business change.
 */
export interface AuditLogResponse {
  id: string; // BigInt serialized as string (safe for JSON and JS clients)
  user: { id: number; name: string; email: string };
  action: string;
  entity: string;
  entityId: number | null;
  occurredAt: Date;
  previousData: unknown;
  newData: unknown;
}

export const auditLogsService = {
  async record(params: RecordAuditParams, db?: DbClient): Promise<void> {
    await auditLogsRepository.create(
      {
        userId: params.actorId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        previousData: sanitize(params.previousData),
        newData: sanitize(params.newData),
      },
      db,
    );
  },

  /** Read side (RN-7 / P-AD-3): Admin consults the trail with filters. */
  async list(query: ListAuditLogsQuery): Promise<PaginatedResult<AuditLogResponse>> {
    const filters: AuditLogFilters = {
      userId: query.userId,
      entity: query.entity,
      action: query.action,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    };
    const [logs, total] = await Promise.all([
      auditLogsRepository.findMany(filters, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      auditLogsRepository.count(filters),
    ]);
    return {
      items: logs.map((log) => ({
        id: log.id.toString(), // AuditLog PK is BigInt
        user: log.user,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        occurredAt: log.occurredAt,
        previousData: log.previousData,
        newData: log.newData,
      })),
      total,
    };
  },
};
