import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { idParamSchema } from '../../shared/schemas';
import { usersController } from './users.controller';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from './users.schemas';

/**
 * User management is Admin-only (functional doc §2.1).
 * State changes (activate/deactivate) are explicit POST actions,
 * not generic PATCHes (Stage 1 convention).
 */
export const usersRoutes = Router();

usersRoutes.use(authenticate, authorize('ADMIN'));

usersRoutes.get('/', validate(listUsersQuerySchema, 'query'), usersController.list);
usersRoutes.get('/:id', validate(idParamSchema, 'params'), usersController.getById);
usersRoutes.post('/', validate(createUserSchema), usersController.create);
usersRoutes.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateUserSchema),
  usersController.update,
);
usersRoutes.post('/:id/activate', validate(idParamSchema, 'params'), usersController.activate);
usersRoutes.post('/:id/deactivate', validate(idParamSchema, 'params'), usersController.deactivate);
usersRoutes.delete('/:id', validate(idParamSchema, 'params'), usersController.remove);
