import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { idParamSchema } from '../../shared/schemas';
import { vehiclesController } from './vehicles.controller';
import {
  createVehicleSchema,
  listVehiclesQuerySchema,
  updateVehicleSchema,
} from './vehicles.schemas';

/**
 * Reads: ADMIN + OPERATOR (fleet listing by status is an operator view).
 * Mutations: ADMIN. INACTIVE transitions: ADMIN only — RN-16/A-8 says no
 * other role has that permission, and it is enforced here at the route.
 */
export const vehiclesRoutes = Router();

vehiclesRoutes.use(authenticate);

vehiclesRoutes.get(
  '/',
  authorize('ADMIN', 'OPERATOR'),
  validate(listVehiclesQuerySchema, 'query'),
  vehiclesController.list,
);
vehiclesRoutes.get(
  '/:id',
  authorize('ADMIN', 'OPERATOR'),
  validate(idParamSchema, 'params'),
  vehiclesController.getById,
);
vehiclesRoutes.post('/', authorize('ADMIN'), validate(createVehicleSchema), vehiclesController.create);
vehiclesRoutes.patch(
  '/:id',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateVehicleSchema),
  vehiclesController.update,
);
vehiclesRoutes.post(
  '/:id/activate',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  vehiclesController.activate,
);
vehiclesRoutes.post(
  '/:id/deactivate',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  vehiclesController.deactivate,
);
vehiclesRoutes.delete(
  '/:id',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  vehiclesController.remove,
);
