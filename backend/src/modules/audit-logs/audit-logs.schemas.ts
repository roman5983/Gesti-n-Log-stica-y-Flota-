import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

/** Read-side filters for the audit trail (P-AD-3). */
export const listAuditLogsQuerySchema = paginationSchema.extend({
  userId: z.coerce.number().int().positive().optional(),
  entity: z.string().max(30).optional(),
  action: z.string().max(30).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
