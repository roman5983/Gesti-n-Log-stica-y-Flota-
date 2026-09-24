import { z } from 'zod';
import { paginationSchema, sortOrderSchema } from '../../shared/schemas';

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
  'VOYAGE_NOT_ASSIGNED',
] as const;

export const ENTITY_TYPES = ['DRIVER', 'VEHICLE', 'DRIVER_DOCUMENT', 'TRIP'] as const;

/** Fields the alert list can be sorted by. */
export const ALERT_SORT_FIELDS = ['raisedAt', 'alertType'] as const;
export type AlertSortField = (typeof ALERT_SORT_FIELDS)[number];

export const listAlertsQuerySchema = paginationSchema.extend({
  status: z.enum(['PENDING', 'RESOLVED']).optional(),
  entityType: z.enum(ENTITY_TYPES).optional(),
  alertType: z.string().max(50).optional(),
  /** Alerts about one vehicle (entityType VEHICLE + entityId). */
  vehicleId: z.coerce.number().int().positive().optional(),
  /** Period, on the date the alert was raised (inclusive). */
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  /** Omitted → pending first, newest first (the triage order of the inbox). */
  sortBy: z.enum(ALERT_SORT_FIELDS).optional(),
  sortOrder: sortOrderSchema,
});
export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>;
