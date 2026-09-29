import express, { type Router } from 'express';
import swaggerUi from 'swagger-ui-express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import './shared/zod-es';
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
import { openApiDocument } from './docs/openapi';

/**
 * Every module router and where it is mounted under /api/v1. Exported so the
 * OpenAPI test can check that each route is documented.
 */
export const API_ROUTES: [prefix: string, router: Router][] = [
  ['/auth', authRoutes],
  ['/users', usersRoutes],
  ['/drivers', driversRoutes],
  ['/drivers/:driverId/documents', documentsRoutes],
  ['/vehicles', vehiclesRoutes],
  ['/maintenance-types', maintenanceTypesRoutes],
  ['/maintenances', maintenancesRoutes],
  ['/trips', tripsRoutes],
  ['/reports', reportsRoutes],
  ['/alerts', alertsRoutes],
  ['/audit-logs', auditLogsRoutes],
  ['/dashboard', dashboardRoutes],
  ['/settings', settingsRoutes],
];

/**
 * Express app assembly. Kept separate from server.ts so tests can import
 * the app without opening a port.
 */
export function createApp(): express.Express {
  const app = express();

  // Behind reverse proxies (Render, and Vercel in front of it) the socket
  // address is the proxy's: req.ip must come from X-Forwarded-For, trusting
  // exactly the configured number of hops (see env.TRUST_PROXY).
  if (env.TRUST_PROXY > 0) app.set('trust proxy', env.TRUST_PROXY);

  // --- Global middlewares ---
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true })); // credentials: refresh cookie
  app.use(express.json({ limit: '100kb' })); // JSON bodies are small; files use multipart later
  app.use(cookieParser());
  app.use(
    pinoHttp({
      // Tests fire hundreds of requests: a log line each would bury the results.
      enabled: env.NODE_ENV !== 'test',
      transport: isProduction ? undefined : { target: 'pino-pretty' },
      redact: ['req.headers.authorization', 'req.headers.cookie'], // never log credentials
      // The client IP as Express resolves it (after trust proxy): the same
      // value the rate limiter keys on — used to calibrate TRUST_PROXY.
      customProps: (req) => ({ clientIp: (req as express.Request).ip }),
    }),
  );

  // --- Health check (infrastructure, unversioned) ---
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // --- API v1 (Stage 1 convention: versioned REST) ---
  const apiV1 = express.Router();
  // API responses are per-user and change constantly: no browser or CDN
  // (the Vercel proxy in production) may store them.
  apiV1.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  // API documentation (OpenAPI 3): the JSON spec and Swagger UI to browse it.
  apiV1.get('/openapi.json', (_req, res) => {
    res.json(openApiDocument());
  });
  apiV1.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(undefined, {
      customSiteTitle: 'API — Gestión Logística',
      swaggerOptions: { url: '/api/v1/openapi.json' },
    }),
  );
  for (const [prefix, router] of API_ROUTES) apiV1.use(prefix, router);

  app.use('/api/v1', apiV1);

  // --- Error handling (always last) ---
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
