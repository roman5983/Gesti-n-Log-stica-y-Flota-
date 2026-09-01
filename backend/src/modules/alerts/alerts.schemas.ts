import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

/**
 * Alert types are an open, extensible taxonomy (C-4): stored as VARCHAR, not
 * an enum. These are the values the evaluator currently emits; new ones can
 * be added without a schema/DB change.
 */
export const ALERT_TYPES = [
  'LICENSE_EXPIRING',
  'LICENSE_EXPIRED',
  'DOCUMENT_EXPIRING',
  'DOCUMENT_EXPIRED',
  'INSURANCE_EXPIRING',
  'INSURANCE_EXPIRED',
  'MAINTENANCE_KM_EXCEEDED',
  'VEHICLE_INACTIVE',
] as const;

export const ENTITY_TYPES = ['DRIVER', 'VEHICLE', 'DRIVER_DOCUMENT'] as const;

export const listAlertsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'RESOLVED']).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  alertType: z.string().max(50).optional(),
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
