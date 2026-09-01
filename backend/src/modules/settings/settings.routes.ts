import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { settingsController } from './settings.controller';
import { updateSettingsSchema } from './settings.schemas';

/** Company settings (P-AD-6). Admin-only. */
export const settingsRoutes = Router();

settingsRoutes.use(authenticate, authorize('ADMIN'));

settingsRoutes.get('/', settingsController.get);
settingsRoutes.put('/', validate(updateSettingsSchema), settingsController.update);
