import { z } from 'zod';

/**
 * Company settings update (P-AD-6). Partial: any subset of fields can be sent.
 * The single settings row (id = 1) is created by the seed and only updated.
 */
export const updateSettingsSchema = z
  .object({
    companyName: z.string().min(1).max(150).optional(),
    taxId: z.string().min(1).max(13).optional(),
    address: z.string().min(1).max(200).optional(),
    phone: z.string().min(1).max(30).optional(),
    email: z.string().email().max(150).optional(),
    timezone: z.string().min(1).max(50).optional(),
    language: z.string().min(1).max(10).optional(),
    dateFormat: z.string().min(1).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;
