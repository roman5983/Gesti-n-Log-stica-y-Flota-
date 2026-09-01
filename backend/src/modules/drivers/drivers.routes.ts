import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { idParamSchema } from '../../shared/schemas';
import { driversController } from './drivers.controller';
import {
  changeDriverPasswordSchema,
  createDriverSchema,
  listDriversQuerySchema,
  updateDriverSchema,
} from './drivers.schemas';

/**
 * Reads: ADMIN + OPERATOR (the Operator sidebar includes "Choferes" and the
 * trip-assignment flow needs the available-drivers list, RN-19).
 * Mutations and credentials (A-9/F-4): ADMIN only.
 */
export const driversRoutes = Router();

driversRoutes.use(authenticate);

driversRoutes.get(
  '/',
  authorize('ADMIN', 'OPERATOR'),
  validate(listDriversQuerySchema, 'query'),
  driversController.list,
);
driversRoutes.get(
  '/:id',
  authorize('ADMIN', 'OPERATOR'),
  validate(idParamSchema, 'params'),
  driversController.getById,
);
driversRoutes.post('/', authorize('ADMIN'), validate(createDriverSchema), driversController.create);
driversRoutes.patch(
  '/:id',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(updateDriverSchema),
  driversController.update,
);
driversRoutes.get(
  '/:id/password',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  driversController.getPassword,
);
driversRoutes.put(
  '/:id/password',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  validate(changeDriverPasswordSchema),
  driversController.changePassword,
);
