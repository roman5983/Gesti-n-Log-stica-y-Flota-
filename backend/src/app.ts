import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isProduction } from './config/env';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { authRoutes } from './modules/auth/auth.routes';
import { usersRoutes } from './modules/users/users.routes';
import { driversRoutes } from './modules/drivers/drivers.routes';
import { vehiclesRoutes } from './modules/vehicles/vehicles.routes';
import { maintenanceTypesRoutes } from './modules/maintenance-types/maintenance-types.routes';
import { maintenancesRoutes } from './modules/maintenances/maintenances.routes';
import { documentsRoutes } from './modules/documents/documents.routes';
import { tripsRoutes } from './modules/trips/trips.routes';
import { reportsRoutes } from './modules/reports/reports.routes';
import { alertsRoutes } from './modules/alerts/alerts.routes';
import { auditLogsRoutes } from './modules/audit-logs/audit-logs.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { settingsRoutes } from './modules/settings/settings.routes';

/**
 * Express app assembly. Kept separate from server.ts so tests can import
 * the app without opening a port.
 */
export function createApp(): express.Express {
  const app = express();

  // --- Global middlewares ---
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true })); // credentials: refresh cookie
  app.use(express.json({ limit: '100kb' })); // JSON bodies are small; files use multipart later
  app.use(cookieParser());
  app.use(
    pinoHttp({
      transport: isProduction ? undefined : { target: 'pino-pretty' },
      redact: ['req.headers.authorization', 'req.headers.cookie'], // never log credentials
    }),
  );

  // --- Health check (infrastructure, unversioned) ---
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // --- API v1 (Stage 1 convention: versioned REST) ---
  const apiV1 = express.Router();
  apiV1.use('/auth', authRoutes);
  apiV1.use('/users', usersRoutes);
  apiV1.use('/drivers', driversRoutes);
  apiV1.use('/drivers/:driverId/documents', documentsRoutes);
  apiV1.use('/vehicles', vehiclesRoutes);
  apiV1.use('/maintenance-types', maintenanceTypesRoutes);
  apiV1.use('/maintenances', maintenancesRoutes);
  apiV1.use('/trips', tripsRoutes);
  apiV1.use('/reports', reportsRoutes);
  apiV1.use('/alerts', alertsRoutes);
  apiV1.use('/audit-logs', auditLogsRoutes);
  apiV1.use('/dashboard', dashboardRoutes);
  apiV1.use('/settings', settingsRoutes);

  app.use('/api/v1', apiV1);

  // --- Error handling (always last) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
