import { z } from 'zod';

/**
 * Driver documents (F-4). The file itself is sent as multipart; these
 * schemas validate the accompanying fields. Document type LICENSE here is
 * the scanned copy — the license's legal validity lives on the driver
 * record (C-2), not on this document.
 */
export const documentTypeSchema = z.enum(['DNI', 'LICENSE', 'ART', 'PSYCHOPHYSICAL']);

export const createDocumentSchema = z.object({
  documentType: documentTypeSchema,
  expiryDate: z.coerce.date(),
});
export type CreateDocumentDto = z.infer<typeof createDocumentSchema>;

/** Metadata-only update (to replace the file, upload a new document). */
export const updateDocumentSchema = z
  .object({
    documentType: documentTypeSchema.optional(),
    expiryDate: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });
export type UpdateDocumentDto = z.infer<typeof updateDocumentSchema>;

/** Params for /drivers/:driverId/documents/:documentId */
export const driverParamSchema = z.object({
  driverId: z.coerce.number().int().positive(),
});
export type DriverParam = z.infer<typeof driverParamSchema>;

export const documentParamsSchema = z.object({
  driverId: z.coerce.number().int().positive(),
  documentId: z.coerce.number().int().positive(),
});
export type DocumentParams = z.infer<typeof documentParamsSchema>;
