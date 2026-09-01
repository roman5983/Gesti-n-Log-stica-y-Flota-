import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { reportsController } from './reports.controller';
import { reportQuerySchema } from './reports.schemas';

/** Reports are an Admin-only module (P-AD-5 / A-11). Read-only. */
export const reportsRoutes = Router();

reportsRoutes.use(authenticate, authorize('ADMIN'));

reportsRoutes.get('/trips', validate(reportQuerySchema, 'query'), reportsController.tripReport);
