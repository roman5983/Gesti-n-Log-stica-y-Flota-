import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

/**
 * DRIVER is intentionally absent from create/update role options:
 * drivers require DNI + license data and are created atomically
 * (user + driver row) through the Drivers module (POST /drivers).
 */
const assignableRoles = z.enum(['ADMIN', 'OPERATOR'], {
  errorMap: () => ({
    message: 'Role must be ADMIN or OPERATOR. Drivers are created via POST /api/v1/drivers',
  }),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(150),
  password: passwordSchema,
  role: assignableRoles,
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    email: z.string().email().max(150).optional(),
    password: passwordSchema.optional(),
    role: assignableRoles.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

const roleEnum = z.enum(['ADMIN', 'OPERATOR', 'DRIVER']);

/**
 * `role` accepts a single role or a comma-separated list (e.g. "ADMIN,OPERATOR")
 * so a caller can list only administrative accounts. Always normalized to an
 * array of valid roles.
 */
export const listUsersQuerySchema = paginationSchema.extend({
  role: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const parsed = v.split(',').map((r) => r.trim().toUpperCase());
      const result = z.array(roleEnum).safeParse(parsed);
      if (!result.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid role value' });
        return z.NEVER;
      }
      return result.data;
    }),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(150).optional(),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
