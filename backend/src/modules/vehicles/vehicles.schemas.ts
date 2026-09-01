import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

const currentYear = new Date().getFullYear();

const licensePlateSchema = z
  .string()
  .min(6)
  .max(10)
  .regex(/^[A-Z0-9 ]+$/i, 'License plate must contain only letters, numbers and spaces')
  .transform((v) => v.toUpperCase().trim());

export const createVehicleSchema = z.object({
  licensePlate: licensePlateSchema,
  model: z.string().min(2).max(100),
  year: z.coerce.number().int().min(1950).max(currentYear + 1),
  /** A-13: initial km is entered manually when the vehicle is registered. */
  initialKm: z.coerce.number().int().min(0),
  insuranceExpiryDate: z.coerce.date().optional(),
});
export type CreateVehicleDto = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = z
  .object({
    licensePlate: licensePlateSchema.optional(),
    model: z.string().min(2).max(100).optional(),
    year: z.coerce.number().int().min(1950).max(currentYear + 1).optional(),
    /** Editable only while the vehicle has no history (see service). */
    initialKm: z.coerce.number().int().min(0).optional(),
    insuranceExpiryDate: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateVehicleDto = z.infer<typeof updateVehicleSchema>;

export const listVehiclesQuerySchema = paginationSchema.extend({
  /** C-1 status filter for the fleet listing. */
  status: z.enum(['AVAILABLE', 'INACTIVE', 'IN_WORKSHOP', 'ON_TRIP']).optional(),
  search: z.string().max(100).optional(),
});
export type ListVehiclesQuery = z.infer<typeof listVehiclesQuerySchema>;
