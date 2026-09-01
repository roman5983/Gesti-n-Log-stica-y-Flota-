import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { createUploader } from '../../middlewares/upload';
import { idParamSchema } from '../../shared/schemas';
import { maintenancesController } from './maintenances.controller';
import {
  attachmentParamsSchema,
  createMaintenanceSchema,
  listMaintenancesQuerySchema,
  updateMaintenanceSchema,
} from './maintenances.schemas';

/**
 * Maintenance operation is the Operator's job (P-OP-5); Admin has full
 * access too. State transitions are explicit POST actions (Stage 1
 * convention) so the C-6 state machine cannot be bypassed.
 */
export const maintenancesRoutes = Router();
const upload = createUploader();

maintenancesRoutes.use(authenticate, authorize('ADMIN', 'OPERATOR'));

maintenancesRoutes.get(
  '/',
  validate(listMaintenancesQuerySchema, 'query'),
  maintenancesController.list,
);
maintenancesRoutes.get('/:id', validate(idParamSchema, 'params'), maintenancesController.getById);
maintenancesRoutes.post('/', validate(createMaintenanceSchema), maintenancesController.create);
maintenancesRoutes.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateMaintenanceSchema),
  maintenancesController.update,
);
maintenancesRoutes.post('/:id/start', validate(idParamSchema, 'params'), maintenancesController.start);
maintenancesRoutes.post(
  '/:id/complete',
  validate(idParamSchema, 'params'),
  maintenancesController.complete,
);
maintenancesRoutes.post(
  '/:id/attachments',
  validate(idParamSchema, 'params'),
  upload.single('file'),
  maintenancesController.addAttachment,
);
maintenancesRoutes.get(
  '/:id/attachments/:attachmentId',
  validate(attachmentParamsSchema, 'params'),
  maintenancesController.downloadAttachment,
);
// Note: attachments are append-only (RN-22 integrity) — no delete/replace route.
