import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { idParamSchema } from '../../shared/schemas';
import { tripsController } from './trips.controller';
import {
  assignTripSchema,
  createTripSchema,
  finishTripSchema,
  listTripsQuerySchema,
  updateTripSchema,
} from './trips.schemas';

/**
 * Trips are the operator's core workflow; admins have full access. Drivers
 * can read their own trips (list/detail scoped in the service) and finish
 * their current one (A-3). State transitions are explicit POST actions so
 * the PENDING_ASSIGNMENT → IN_PROGRESS → COMPLETED machine can't be bypassed.
 */
export const tripsRoutes = Router();

tripsRoutes.use(authenticate);

// Reads: all roles (driver results are scoped to their own trips in service).
tripsRoutes.get(
  '/',
  authorize('ADMIN', 'OPERATOR', 'DRIVER'),
  validate(listTripsQuerySchema, 'query'),
  tripsController.list,
);
tripsRoutes.get(
  '/:id',
  authorize('ADMIN', 'OPERATOR', 'DRIVER'),
  validate(idParamSchema, 'params'),
  tripsController.getById,
);

// Planning & assignment: operator/admin.
tripsRoutes.post('/', authorize('ADMIN', 'OPERATOR'), validate(createTripSchema), tripsController.create);
tripsRoutes.patch(
  '/:id',
  authorize('ADMIN', 'OPERATOR'),
  validate(idParamSchema, 'params'),
  validate(updateTripSchema),
  tripsController.update,
);
tripsRoutes.post(
  '/:id/assign',
  authorize('ADMIN', 'OPERATOR'),
  validate(idParamSchema, 'params'),
  validate(assignTripSchema),
  tripsController.assign,
);

// Finish: driver (own trip) or operator/admin (A-3).
tripsRoutes.post(
  '/:id/finish',
  authorize('ADMIN', 'OPERATOR', 'DRIVER'),
  validate(idParamSchema, 'params'),
  validate(finishTripSchema),
  tripsController.finish,
);

// Delete: only while pending assignment (RN-15), operator/admin.
tripsRoutes.delete(
  '/:id',
  authorize('ADMIN', 'OPERATOR'),
  validate(idParamSchema, 'params'),
  tripsController.remove,
);
