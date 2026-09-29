import { z } from 'zod';

/**
 * Company settings update (P-AD-6). Partial: any subset of fields can be sent.
 * The single settings row (id = 1) is created by the seed and only updated.
 *
 * Timezone, language and date format are fixed (team decision, 28/09/2026):
 * the app always works in Argentine time, in Spanish, with dd/mm/aaaa. They
 * are still returned by GET /settings, but not editable — `.strict()` rejects
 * them with an explicit message instead of silently ignoring them.
 */
export const updateSettingsSchema = z
  .object({
    companyName: z.string().min(1).max(150).optional(),
    taxId: z.string().min(1).max(13).optional(),
    address: z.string().min(1).max(200).optional(),
    phone: z.string().min(1).max(30).optional(),
    email: z.string().email().max(150).optional(),
  })
  .strict('La zona horaria, el idioma y el formato de fecha son fijos y no se pueden modificar')
  .refine((data) => Object.keys(data).length > 0, { message: 'Se requiere al menos un campo' });
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
