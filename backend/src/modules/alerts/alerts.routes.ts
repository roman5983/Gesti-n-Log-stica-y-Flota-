import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { idParamSchema } from '../../shared/schemas';
import { alertsController } from './alerts.controller';
import { listAlertsQuerySchema } from './alerts.schemas';

/**
 * Alerts feed the dashboards, so reads are ADMIN + OPERATOR. Resolving and
 * running the evaluation are ADMIN-only (the Admin manages alerts, P-AD-4).
 */
export const alertsRoutes = Router();

alertsRoutes.use(authenticate);

alertsRoutes.get(
  '/',
  authorize('ADMIN', 'OPERATOR'),
  validate(listAlertsQuerySchema, 'query'),
  alertsController.list,
);
alertsRoutes.post('/evaluate', authorize('ADMIN'), alertsController.evaluate);
alertsRoutes.post(
  '/:id/resolve',
  authorize('ADMIN'),
  validate(idParamSchema, 'params'),
  alertsController.resolve,
);
