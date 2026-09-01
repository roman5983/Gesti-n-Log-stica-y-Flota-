import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { validate } from '../../middlewares/validate';
import { auditLogsController } from './audit-logs.controller';
import { listAuditLogsQuerySchema } from './audit-logs.schemas';

/** Audit trail is Admin-only and read-only (RN-7 / A-5 / P-AD-3). */
export const auditLogsRoutes = Router();

auditLogsRoutes.use(authenticate, authorize('ADMIN'));

auditLogsRoutes.get('/', validate(listAuditLogsQuerySchema, 'query'), auditLogsController.list);
