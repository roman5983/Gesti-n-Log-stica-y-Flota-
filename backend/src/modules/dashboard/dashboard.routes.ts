import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { dashboardController } from './dashboard.controller';

/**
 * Live KPI dashboard (P-AD-1). Both the Operator and the Admin have a
 * dashboard; the payload is the same and the frontend renders per role.
 */
export const dashboardRoutes = Router();

dashboardRoutes.use(authenticate, authorize('ADMIN', 'OPERATOR'));

dashboardRoutes.get('/', dashboardController.metrics);
