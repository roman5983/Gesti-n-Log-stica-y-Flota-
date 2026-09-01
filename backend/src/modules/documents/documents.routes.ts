import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { createUploader } from '../../middlewares/upload';
import { documentsController } from './documents.controller';
import {
  createDocumentSchema,
  documentParamsSchema,
  driverParamSchema,
  updateDocumentSchema,
} from './documents.schemas';

/**
 * Nested under /drivers/:driverId/documents (mergeParams to read :driverId).
 *
 * Permissions (compliance): a DRIVER may only VIEW/download (GET) their OWN
 * documents. Uploading (POST), editing (PATCH) and deleting (DELETE) are
 * ADMIN-only, so a driver cannot upload, falsify or hide their own
 * compliance status. Resource-level ownership (driver ↔ own documents) is
 * resolved in the service. Operators are excluded from this flow entirely.
 */
export const documentsRoutes = Router({ mergeParams: true });
const upload = createUploader();

documentsRoutes.use(authenticate);

// Read + upload: ADMIN or the driver themselves.
documentsRoutes.get(
  '/',
  authorize('ADMIN', 'DRIVER'),
  validate(driverParamSchema, 'params'),
  documentsController.list,
);
// Upload is Admin-only (decision change): the driver only views their
// documents; the Admin uploads them from the Drivers module.
documentsRoutes.post(
  '/',
  authorize('ADMIN'),
  validate(driverParamSchema, 'params'),
  upload.single('file'),
  validate(createDocumentSchema),
  documentsController.create,
);
documentsRoutes.get(
  '/:documentId',
  authorize('ADMIN', 'DRIVER'),
  validate(documentParamsSchema, 'params'),
  documentsController.download,
);

// Mutations that affect compliance status: ADMIN only.
documentsRoutes.patch(
  '/:documentId',
  authorize('ADMIN'),
  validate(documentParamsSchema, 'params'),
  validate(updateDocumentSchema),
  documentsController.update,
);
documentsRoutes.delete(
  '/:documentId',
  authorize('ADMIN'),
  validate(documentParamsSchema, 'params'),
  documentsController.remove,
);
