import { z } from 'zod';
import { paginationSchema } from '../../shared/schemas';

/**
 * DRIVER is intentionally absent from create/update role options:
 * drivers require DNI + license data and are created atomically
 * (user + driver row) through the Drivers module (POST /drivers).
 */
const assignableRoles = z.enum(['ADMIN', 'OPERATOR'], {
  errorMap: () => ({
    message: 'El rol debe ser ADMIN u OPERATOR. Los choferes se crean desde la sección Choferes',
  }),
});

const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Za-z]/, 'La contraseña debe contener una letra')
  .regex(/\d/, 'La contraseña debe contener un número');

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
  .refine((data) => Object.keys(data).length > 0, { message: 'Se requiere al menos un campo' });
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
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valor de rol inválido' });
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
