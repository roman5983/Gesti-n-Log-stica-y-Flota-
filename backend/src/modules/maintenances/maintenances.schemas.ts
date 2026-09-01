import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

/**
 * A maintenance is registered as PENDING (scheduled). The vehicle only moves
 * to IN_WORKSHOP when the intervention starts, and back to AVAILABLE when it
 * completes (C-6, F-6) — those are explicit state transitions, not fields.
 */
/**
 * next maintenance is always ahead of the current odometer reading — same
 * cross-field invariant style as maintenance types (kmTarget >= kmAlert).
 * Validated on the effective km (incoming or, on update, the existing one).
 */
function validateNextKm(
  data: { km?: number; nextMaintenanceKm?: number | null },
  ctx: z.RefinementCtx,
): void {
  if (
    data.km !== undefined &&
    data.nextMaintenanceKm !== undefined &&
    data.nextMaintenanceKm !== null &&
    data.nextMaintenanceKm < data.km
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nextMaintenanceKm'],
      message: 'nextMaintenanceKm must be greater than or equal to km',
    });
  }
}

export const createMaintenanceSchema = z
  .object({
    vehicleId: z.coerce.number().int().positive(),
    maintenanceTypeId: z.coerce.number().int().positive(),
    scheduledAt: z.coerce.date(),
    km: z.coerce.number().int().min(0),
    notes: z.string().max(1000).optional(),
    nextMaintenanceKm: z.coerce.number().int().min(0).optional(),
  })
  .superRefine(validateNextKm);
export type CreateMaintenanceDto = z.infer<typeof createMaintenanceSchema>;

/**
 * Only editable while not COMPLETED (RN-22, enforced in the service).
 * The km/nextMaintenanceKm invariant is checked here when BOTH fields are
 * present; when only one arrives, the service re-checks it against the
 * stored value (the schema has no access to the existing record).
 */
export const updateMaintenanceSchema = z
  .object({
    maintenanceTypeId: z.coerce.number().int().positive().optional(),
    scheduledAt: z.coerce.date().optional(),
    km: z.coerce.number().int().min(0).optional(),
    notes: z.string().max(1000).nullable().optional(),
    nextMaintenanceKm: z.coerce.number().int().min(0).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' })
  .superRefine(validateNextKm);
export type UpdateMaintenanceDto = z.infer<typeof updateMaintenanceSchema>;

/** Params for attachment sub-resource routes: /:id/attachments/:attachmentId */
export const attachmentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  attachmentId: z.coerce.number().int().positive(),
});
export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;

export const listMaintenancesQuerySchema = paginationSchema.extend({
  vehicleId: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  /** C-6 views: "scheduled" = PENDING + IN_PROGRESS, "history" = COMPLETED. */
  view: z.enum(['scheduled', 'history']).optional(),
});
export type ListMaintenancesQuery = z.infer<typeof listMaintenancesQuerySchema>;
