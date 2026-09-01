import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

const dniSchema = z.string().regex(/^\d{7,10}$/, 'DNI must be 7 to 10 digits');

const licenseCategorySchema = z.enum(['A', 'B', 'C', 'E']);

/**
 * Creating a driver creates the user (role DRIVER) and the driver profile
 * atomically — mirrors the Admin "new user with role Chofer" screen (F-1 flow).
 */
export const createDriverSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(150),
  password: passwordSchema,
  dni: dniSchema,
  licenseCategory: licenseCategorySchema,
  licenseExpiryDate: z.coerce.date(),
});
export type CreateDriverDto = z.infer<typeof createDriverSchema>;

export const updateDriverSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().max(150).optional(),
    dni: dniSchema.optional(),
    licenseCategory: licenseCategorySchema.optional(),
    licenseExpiryDate: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateDriverDto = z.infer<typeof updateDriverSchema>;

export const changeDriverPasswordSchema = z.object({
  password: passwordSchema,
});
export type ChangeDriverPasswordDto = z.infer<typeof changeDriverPasswordSchema>;

export const listDriversQuerySchema = paginationSchema.extend({
  /** RN-19 filter: license valid + no active trip (+ active user). */
  available: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(150).optional(),
});
export type ListDriversQuery = z.infer<typeof listDriversQuerySchema>;
