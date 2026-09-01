import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

/**
 * Catalog thresholds (C-7 / RN-13): km-based (kmAlert/kmTarget) and
 * optionally time-based (monthsAlert/monthsTarget). Cross-field rules
 * (target >= alert) are enforced here so invalid catalogs cannot exist.
 */
const baseFields = {
  name: z.string().min(3).max(50),
  description: z.string().min(3).max(255),
  kmAlert: z.coerce.number().int().positive(),
  kmTarget: z.coerce.number().int().positive(),
  monthsAlert: z.coerce.number().int().min(1).max(255).optional(),
  monthsTarget: z.coerce.number().int().min(1).max(255).optional(),
};

function validateThresholds(data: {
  kmAlert: number;
  kmTarget: number;
  monthsAlert?: number;
  monthsTarget?: number;
}, ctx: z.RefinementCtx): void {
  if (data.kmTarget < data.kmAlert) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['kmTarget'],
      message: 'kmTarget must be greater than or equal to kmAlert',
    });
  }
  if (
    data.monthsAlert !== undefined &&
    data.monthsTarget !== undefined &&
    data.monthsTarget < data.monthsAlert
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['monthsTarget'],
      message: 'monthsTarget must be greater than or equal to monthsAlert',
    });
  }
}

export const createMaintenanceTypeSchema = z.object(baseFields).superRefine(validateThresholds);
export type CreateMaintenanceTypeDto = z.infer<typeof createMaintenanceTypeSchema>;

/**
 * Update requires the full threshold set (PUT semantics for thresholds):
 * partial threshold edits could silently break the target >= alert
 * invariant across fields, so the catalog is always updated as a whole.
 */
export const updateMaintenanceTypeSchema = createMaintenanceTypeSchema;
export type UpdateMaintenanceTypeDto = z.infer<typeof updateMaintenanceTypeSchema>;

export const listMaintenanceTypesQuerySchema = paginationSchema;
export type ListMaintenanceTypesQuery = z.infer<typeof listMaintenanceTypesQuerySchema>;
