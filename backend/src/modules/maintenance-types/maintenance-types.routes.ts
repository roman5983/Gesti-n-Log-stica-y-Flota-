import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { idParamSchema } from '../../shared/schemas';
import { maintenanceTypesController } from './maintenance-types.controller';
import {
  createMaintenanceTypeSchema,
  listMaintenanceTypesQuerySchema,
  updateMaintenanceTypeSchema,
} from './maintenance-types.schemas';

/**
 * Reads: ADMIN + OPERATOR (the operator picks a type when registering a
 * maintenance, P-OP-5). Catalog mutations: ADMIN.
 */
export const maintenanceTypesRoutes = Router();

maintenanceTypesRoutes.use(authenticate);

maintenanceTypesRoutes.get(
  '/',
  authorize('ADMIN', 'OPERATOR'),
  validate(listMaintenanceTypesQuerySchema, 'query'),
  maintenanceTypesController.list,
);
maintenanceTypesRoutes.get(
  '/:id',
  authorize('ADMIN', 'OPERATOR'),
  validate(idParamSchema, 'params'),
  maintenanceTypesController.getById,
);
maintenanceTypesRoutes.post(
  '/',
  authorize('ADMIN'),
  validate(createMaintenanceTypeSchema),
  maintenanceTypesController.create,
);
maintenanceTypesRoutes.put(
  '/:id',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateMaintenanceTypeSchema),
  maintenanceTypesController.update,
);
maintenanceTypesRoutes.delete(
  '/:id',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  maintenanceTypesController.remove,
);
