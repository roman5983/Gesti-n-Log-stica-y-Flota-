import { z, type ZodTypeAny } from 'zod';
import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi';
import { idParamSchema } from '../shared/schemas';
import { loginSchema } from '../modules/auth/auth.schemas';
import { createUserSchema, listUsersQuerySchema, updateUserSchema } from '../modules/users/users.schemas';
import {
  changeDriverPasswordSchema,
  createDriverSchema,
  listDriversQuerySchema,
  updateDriverSchema,
} from '../modules/drivers/drivers.schemas';
import {
  createDocumentSchema,
  documentParamsSchema,
  documentTypeSchema,
  driverParamSchema,
  updateDocumentSchema,
} from '../modules/documents/documents.schemas';
import {
  createVehicleSchema,
  listVehiclesQuerySchema,
  updateVehicleSchema,
} from '../modules/vehicles/vehicles.schemas';
import {
  createMaintenanceTypeSchema,
  listMaintenanceTypesQuerySchema,
  updateMaintenanceTypeSchema,
} from '../modules/maintenance-types/maintenance-types.schemas';
import {
  attachmentParamsSchema,
  createMaintenanceSchema,
  listMaintenancesQuerySchema,
  updateMaintenanceSchema,
} from '../modules/maintenances/maintenances.schemas';
import {
  assignTripSchema,
  createTripSchema,
  finishTripSchema,
  listTripsQuerySchema,
  updateTripSchema,
} from '../modules/trips/trips.schemas';
import { reportQuerySchema } from '../modules/reports/reports.schemas';
import { listAlertsQuerySchema } from '../modules/alerts/alerts.schemas';
import { listAuditLogsQuerySchema } from '../modules/audit-logs/audit-logs.schemas';
import { updateSettingsSchema } from '../modules/settings/settings.schemas';

/**
 * OpenAPI 3 description of the API, served as JSON at /api/v1/openapi.json
 * and browsable with Swagger UI at /api/v1/docs.
 *
 * Requests (path params, query strings and bodies) are documented from the
 * SAME Zod schemas the routes validate with, so they cannot drift from what
 * the server accepts. Responses are described by the documentation-only
 * schemas below, which mirror the `*Response` interfaces of each service.
 * `openapi.test.ts` checks that every Express route appears here.
 */

extendZodWithOpenApi(z);

// ---------------------------------------------------------------------------
// Response shapes (documentation only)
// ---------------------------------------------------------------------------

const Role = z.enum(['ADMIN', 'OPERATOR', 'DRIVER']);
const DateTime = z.string().datetime().openapi({ example: '2026-09-28T13:00:00.000Z' });

const ErrorResponse = z
  .object({
    error: z.object({
      code: z.string().openapi({ example: 'BUSINESS_RULE' }),
      message: z.string().openapi({ example: 'El chofer ya tiene un viaje en curso' }),
      details: z
        .array(z.object({ path: z.string(), message: z.string() }))
        .optional()
        .openapi({ description: 'Solo en errores de validación (400): un elemento por campo inválido.' }),
    }),
  })
  .openapi('Error');

const PaginationMeta = z
  .object({ page: z.number().int(), limit: z.number().int(), total: z.number().int() })
  .openapi('PaginationMeta');

const PublicUser = z
  .object({ id: z.number().int(), name: z.string(), email: z.string(), role: Role })
  .openapi('PublicUser');

const Session = z
  .object({ user: PublicUser, accessToken: z.string().openapi({ description: 'JWT de 15 minutos.' }) })
  .openapi('Session');

const UserProfile = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    role: Role,
    isActive: z.boolean(),
    createdAt: DateTime,
    driver: z
      .object({
        dni: z.string(),
        licenseCategory: z.enum(['A', 'B', 'C', 'E']),
        licenseExpiryDate: DateTime,
        completedTrips: z.number().int(),
        avgKm: z.number(),
      })
      .nullable(),
  })
  .openapi('UserProfile');

const User = z
  .object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
    role: Role,
    isActive: z.boolean(),
    createdAt: DateTime,
    updatedAt: DateTime,
  })
  .openapi('User');

const Driver = z
  .object({
    id: z.number().int().openapi({ description: 'Id del usuario (clave compartida).' }),
    name: z.string(),
    email: z.string(),
    isActive: z.boolean(),
    dni: z.string(),
    licenseCategory: z.enum(['A', 'B', 'C', 'E']),
    licenseExpiryDate: DateTime,
    licenseValid: z.boolean(),
    documentsComplete: z.boolean().openapi({ description: 'RN-4: DNI, licencia, ART y psicofísico cargados y vigentes.' }),
    available: z.boolean().openapi({ description: 'Se le puede asignar un viaje hoy.' }),
    completedTrips: z.number().int(),
    avgKm: z.number(),
  })
  .openapi('Driver');

const DriverDocument = z
  .object({
    id: z.number().int(),
    driverId: z.number().int(),
    documentType: documentTypeSchema,
    expiryDate: DateTime,
    expired: z.boolean(),
    fileName: z.string(),
    mimeType: z.string(),
    fileSize: z.number().int(),
    uploadedAt: DateTime,
  })
  .openapi('DriverDocument');

const VehicleStatus = z.enum(['AVAILABLE', 'INACTIVE', 'IN_WORKSHOP', 'ON_TRIP']);
const Vehicle = z
  .object({
    id: z.number().int(),
    licensePlate: z.string(),
    model: z.string(),
    year: z.number().int(),
    initialKm: z.number().int(),
    accumulatedKm: z.number().int(),
    lastMaintenanceDate: DateTime.nullable(),
    insuranceExpiryDate: DateTime.nullable(),
    insuranceValid: z.boolean(),
    status: VehicleStatus,
    createdAt: DateTime,
    updatedAt: DateTime,
  })
  .openapi('Vehicle');

const MaintenanceType = z
  .object({
    id: z.number().int(),
    name: z.string(),
    description: z.string(),
    kmAlert: z.number().int(),
    kmTarget: z.number().int(),
    monthsAlert: z.number().int().nullable(),
    monthsTarget: z.number().int().nullable(),
  })
  .openapi('MaintenanceType');

const Attachment = z
  .object({
    id: z.number().int(),
    fileName: z.string(),
    mimeType: z.string(),
    fileSize: z.number().int(),
    uploadedAt: DateTime,
  })
  .openapi('MaintenanceAttachment');

const Maintenance = z
  .object({
    id: z.number().int(),
    vehicle: z.object({ id: z.number().int(), licensePlate: z.string(), model: z.string() }),
    maintenanceType: z.object({ id: z.number().int(), name: z.string() }),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    scheduledAt: DateTime,
    completedAt: DateTime.nullable(),
    km: z.number().int(),
    notes: z.string().nullable(),
    nextMaintenanceKm: z.number().int().nullable(),
    attachments: z.array(Attachment),
  })
  .openapi('Maintenance');

const Trip = z
  .object({
    id: z.number().int(),
    origin: z.string(),
    destination: z.string(),
    departureAt: DateTime,
    status: z.enum(['PENDING_ASSIGNMENT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    estimatedDistanceKm: z.number().nullable(),
    estimatedTimeMin: z.number().int().nullable(),
    notes: z.string().nullable(),
    operator: z.object({ id: z.number().int(), name: z.string() }),
    driver: z.object({ id: z.number().int(), name: z.string(), dni: z.string() }).nullable(),
    vehicle: z.object({ id: z.number().int(), licensePlate: z.string(), model: z.string() }).nullable(),
    departureKm: z.number().int().nullable(),
    arrivalKm: z.number().int().nullable(),
    assignedAt: DateTime.nullable(),
    finishedAt: DateTime.nullable(),
    createdAt: DateTime,
  })
  .openapi('Trip');

const TripReport = z
  .object({
    period: z.object({ from: DateTime, to: DateTime }),
    summary: z.object({
      completedTrips: z.number().int(),
      totalKm: z.number(),
      averageDistanceKm: z.number(),
      maintenancesCompleted: z.number().int(),
      alertsRaised: z.number().int(),
      alertsResolved: z.number().int(),
    }),
    byDriver: z.array(z.record(z.unknown())),
    byVehicle: z.array(z.record(z.unknown())),
    topDestinations: z.array(z.record(z.unknown())),
  })
  .openapi('TripReport');

const Alert = z
  .object({
    id: z.number().int(),
    alertType: z.string().openapi({ example: 'LICENSE_EXPIRING' }),
    description: z.string(),
    entityType: z.enum(['DRIVER', 'VEHICLE', 'DRIVER_DOCUMENT', 'TRIP']),
    entityId: z.number().int(),
    status: z.enum(['PENDING', 'RESOLVED']),
    raisedAt: DateTime,
    resolvedById: z.number().int().nullable(),
    resolvedAt: DateTime.nullable(),
    linkedDriverId: z.number().int().optional().openapi({ description: 'Solo en alertas de documentos: el chofer dueño.' }),
  })
  .openapi('Alert');

const AlertEvaluation = z
  .object({ evaluated: z.number().int(), created: z.number().int(), autoResolved: z.number().int() })
  .openapi('AlertEvaluation');

const AuditLog = z
  .object({
    id: z.string().openapi({ description: 'BIGINT serializado como texto.' }),
    user: z.object({ id: z.number().int(), name: z.string(), email: z.string() }),
    action: z.string().openapi({ example: 'UPDATE' }),
    entity: z.string().openapi({ example: 'VEHICLE' }),
    entityId: z.number().int().nullable(),
    occurredAt: DateTime,
    previousData: z.unknown(),
    newData: z.unknown(),
  })
  .openapi('AuditLog');

const DashboardMetrics = z
  .object({
    fleet: z.object({
      total: z.number().int(),
      available: z.number().int(),
      inWorkshop: z.number().int(),
      onTrip: z.number().int(),
      inactive: z.number().int(),
    }),
    trips: z.object({ inProgress: z.number().int(), pendingAssignment: z.number().int(), completed: z.number().int() }),
    drivers: z.object({ total: z.number().int(), active: z.number().int() }),
    maintenances: z.object({ pending: z.number().int() }),
    alerts: z.object({ pending: z.number().int() }),
    users: z.object({ total: z.number().int() }),
    tripsPerMonth: z.array(z.object({ month: z.string(), count: z.number().int() })),
  })
  .openapi('DashboardMetrics');

const Settings = z
  .object({
    companyName: z.string(),
    taxId: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    timezone: z.string().openapi({ description: 'Fijo: no se puede modificar.' }),
    language: z.string().openapi({ description: 'Fijo: no se puede modificar.' }),
    dateFormat: z.string().openapi({ description: 'Fijo: no se puede modificar.' }),
    updatedAt: DateTime,
  })
  .openapi('Settings');

// ---------------------------------------------------------------------------
// Route table
// ---------------------------------------------------------------------------

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type RoleName = z.infer<typeof Role>;

interface RouteDoc {
  method: Method;
  /** Express-style path under /api/v1 (":id"), converted to OpenAPI ("{id}"). */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** Roles allowed; omitted = public (no access token). */
  roles?: RoleName[];
  params?: ZodTypeAny;
  query?: ZodTypeAny;
  body?: ZodTypeAny;
  /** multipart/form-data with a `file` part (plus `body` fields, if any). */
  file?: boolean;
  /** Success status and payload: a schema (wrapped in `data`), 'page' list, 'file' download or none. */
  ok: { status: 200 | 201 | 204; data?: ZodTypeAny; page?: ZodTypeAny; file?: true };
  /** Business-rule errors this route can produce (409/422). */
  rules?: boolean;
}

const ALL: RoleName[] = ['ADMIN', 'OPERATOR', 'DRIVER'];
const STAFF: RoleName[] = ['ADMIN', 'OPERATOR'];
const ADMIN: RoleName[] = ['ADMIN'];

export const ROUTES: RouteDoc[] = [
  // --- Auth ---
  { method: 'post', path: '/auth/login', tag: 'Autenticación', summary: 'Iniciar sesión', description: 'Devuelve el access token y deja el refresh token en una cookie httpOnly. Limitado a 10 intentos cada 15 minutos por IP.', body: loginSchema, ok: { status: 200, data: Session } },
  { method: 'post', path: '/auth/refresh', tag: 'Autenticación', summary: 'Renovar la sesión', description: 'Usa la cookie del refresh token, la rota y devuelve un access token nuevo.', ok: { status: 200, data: Session } },
  { method: 'post', path: '/auth/logout', tag: 'Autenticación', summary: 'Cerrar sesión', description: 'Revoca el refresh token de la cookie. Idempotente.', ok: { status: 204 } },
  { method: 'get', path: '/auth/me', tag: 'Autenticación', summary: 'Usuario actual', roles: ALL, ok: { status: 200, data: PublicUser } },
  { method: 'get', path: '/auth/me/profile', tag: 'Autenticación', summary: 'Perfil completo del usuario actual ("Mis datos")', roles: ALL, ok: { status: 200, data: UserProfile } },

  // --- Users ---
  { method: 'get', path: '/users', tag: 'Usuarios', summary: 'Listar usuarios', roles: ADMIN, query: listUsersQuerySchema, ok: { status: 200, page: User } },
  { method: 'get', path: '/users/:id', tag: 'Usuarios', summary: 'Ver un usuario', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: User } },
  { method: 'post', path: '/users', tag: 'Usuarios', summary: 'Crear un administrador u operador', description: 'Los choferes se crean desde /drivers.', roles: ADMIN, body: createUserSchema, ok: { status: 201, data: User }, rules: true },
  { method: 'patch', path: '/users/:id', tag: 'Usuarios', summary: 'Modificar un usuario', roles: ADMIN, params: idParamSchema, body: updateUserSchema, ok: { status: 200, data: User }, rules: true },
  { method: 'post', path: '/users/:id/activate', tag: 'Usuarios', summary: 'Reactivar un usuario', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: User }, rules: true },
  { method: 'post', path: '/users/:id/deactivate', tag: 'Usuarios', summary: 'Dar de baja un usuario', description: 'Regla del último administrador; un chofer con viaje en curso no se puede dar de baja.', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: User }, rules: true },
  { method: 'delete', path: '/users/:id', tag: 'Usuarios', summary: 'Eliminar un usuario (baja lógica)', description: 'Regla del último administrador; un chofer con viaje en curso no se puede eliminar.', roles: ADMIN, params: idParamSchema, ok: { status: 204 }, rules: true },

  // --- Drivers ---
  { method: 'get', path: '/drivers', tag: 'Choferes', summary: 'Listar choferes', description: '`available=true` devuelve los que se pueden asignar hoy (activos, licencia vigente, sin viaje en curso y documentación completa).', roles: STAFF, query: listDriversQuerySchema, ok: { status: 200, page: Driver } },
  { method: 'get', path: '/drivers/:id', tag: 'Choferes', summary: 'Ver un chofer', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Driver } },
  { method: 'post', path: '/drivers', tag: 'Choferes', summary: 'Crear un chofer', description: 'Genera la contraseña y la envía por correo (A-9, DOC-1).', roles: ADMIN, body: createDriverSchema, ok: { status: 201, data: Driver }, rules: true },
  { method: 'patch', path: '/drivers/:id', tag: 'Choferes', summary: 'Modificar un chofer', roles: ADMIN, params: idParamSchema, body: updateDriverSchema, ok: { status: 200, data: Driver }, rules: true },
  { method: 'get', path: '/drivers/:id/password', tag: 'Choferes', summary: 'Consultar la contraseña del chofer (A-9)', description: 'Queda registrado en la auditoría.', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: z.object({ password: z.string() }) } },
  { method: 'put', path: '/drivers/:id/password', tag: 'Choferes', summary: 'Cambiar la contraseña del chofer', roles: ADMIN, params: idParamSchema, body: changeDriverPasswordSchema, ok: { status: 204 } },

  // --- Driver documents ---
  { method: 'get', path: '/drivers/:driverId/documents', tag: 'Documentación', summary: 'Listar la documentación de un chofer', description: 'Un chofer solo puede ver la suya.', roles: ['ADMIN', 'DRIVER'], params: driverParamSchema, ok: { status: 200, data: z.array(DriverDocument) } },
  { method: 'post', path: '/drivers/:driverId/documents', tag: 'Documentación', summary: 'Subir un documento', description: 'PDF, JPG o PNG de hasta 1 MB.', roles: ADMIN, params: driverParamSchema, body: createDocumentSchema, file: true, ok: { status: 201, data: DriverDocument }, rules: true },
  { method: 'get', path: '/drivers/:driverId/documents/:documentId', tag: 'Documentación', summary: 'Descargar un documento', roles: ['ADMIN', 'DRIVER'], params: documentParamsSchema, ok: { status: 200, file: true } },
  { method: 'patch', path: '/drivers/:driverId/documents/:documentId', tag: 'Documentación', summary: 'Modificar tipo o vencimiento de un documento', roles: ADMIN, params: documentParamsSchema, body: updateDocumentSchema, ok: { status: 200, data: DriverDocument }, rules: true },
  { method: 'delete', path: '/drivers/:driverId/documents/:documentId', tag: 'Documentación', summary: 'Eliminar un documento', description: 'No se puede con el chofer en un viaje en curso.', roles: ADMIN, params: documentParamsSchema, ok: { status: 204 }, rules: true },

  // --- Vehicles ---
  { method: 'get', path: '/vehicles', tag: 'Vehículos', summary: 'Listar vehículos', roles: STAFF, query: listVehiclesQuerySchema, ok: { status: 200, page: Vehicle } },
  { method: 'get', path: '/vehicles/:id', tag: 'Vehículos', summary: 'Ver un vehículo', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Vehicle } },
  { method: 'post', path: '/vehicles', tag: 'Vehículos', summary: 'Crear un vehículo', roles: ADMIN, body: createVehicleSchema, ok: { status: 201, data: Vehicle }, rules: true },
  { method: 'patch', path: '/vehicles/:id', tag: 'Vehículos', summary: 'Modificar un vehículo', roles: ADMIN, params: idParamSchema, body: updateVehicleSchema, ok: { status: 200, data: Vehicle }, rules: true },
  { method: 'post', path: '/vehicles/:id/activate', tag: 'Vehículos', summary: 'Reactivar un vehículo inactivo', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: Vehicle }, rules: true },
  { method: 'post', path: '/vehicles/:id/deactivate', tag: 'Vehículos', summary: 'Dar de baja un vehículo', description: 'No se puede en viaje ni en taller.', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: Vehicle }, rules: true },
  { method: 'delete', path: '/vehicles/:id', tag: 'Vehículos', summary: 'Eliminar un vehículo (baja lógica)', description: 'No se puede en viaje ni con un mantenimiento abierto.', roles: ADMIN, params: idParamSchema, ok: { status: 204 }, rules: true },

  // --- Maintenance types ---
  { method: 'get', path: '/maintenance-types', tag: 'Tipos de mantenimiento', summary: 'Listar tipos de mantenimiento', roles: STAFF, query: listMaintenanceTypesQuerySchema, ok: { status: 200, page: MaintenanceType } },
  { method: 'get', path: '/maintenance-types/:id', tag: 'Tipos de mantenimiento', summary: 'Ver un tipo de mantenimiento', roles: STAFF, params: idParamSchema, ok: { status: 200, data: MaintenanceType } },
  { method: 'post', path: '/maintenance-types', tag: 'Tipos de mantenimiento', summary: 'Crear un tipo de mantenimiento', roles: ADMIN, body: createMaintenanceTypeSchema, ok: { status: 201, data: MaintenanceType }, rules: true },
  { method: 'put', path: '/maintenance-types/:id', tag: 'Tipos de mantenimiento', summary: 'Modificar un tipo de mantenimiento', roles: ADMIN, params: idParamSchema, body: updateMaintenanceTypeSchema, ok: { status: 200, data: MaintenanceType }, rules: true },
  { method: 'delete', path: '/maintenance-types/:id', tag: 'Tipos de mantenimiento', summary: 'Eliminar un tipo de mantenimiento', description: 'No se puede si algún mantenimiento lo usa.', roles: ADMIN, params: idParamSchema, ok: { status: 204 }, rules: true },

  // --- Maintenances ---
  { method: 'get', path: '/maintenances', tag: 'Mantenimientos', summary: 'Listar mantenimientos', roles: STAFF, query: listMaintenancesQuerySchema, ok: { status: 200, page: Maintenance } },
  { method: 'get', path: '/maintenances/:id', tag: 'Mantenimientos', summary: 'Ver un mantenimiento', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Maintenance } },
  { method: 'post', path: '/maintenances', tag: 'Mantenimientos', summary: 'Registrar un mantenimiento', description: 'Un vehículo tiene como máximo un mantenimiento abierto.', roles: STAFF, body: createMaintenanceSchema, ok: { status: 201, data: Maintenance }, rules: true },
  { method: 'patch', path: '/maintenances/:id', tag: 'Mantenimientos', summary: 'Modificar un mantenimiento pendiente', roles: STAFF, params: idParamSchema, body: updateMaintenanceSchema, ok: { status: 200, data: Maintenance }, rules: true },
  { method: 'post', path: '/maintenances/:id/start', tag: 'Mantenimientos', summary: 'Iniciar un mantenimiento (vehículo → en taller)', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Maintenance }, rules: true },
  { method: 'post', path: '/maintenances/:id/complete', tag: 'Mantenimientos', summary: 'Completar un mantenimiento (vehículo → disponible)', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Maintenance }, rules: true },
  { method: 'post', path: '/maintenances/:id/cancel', tag: 'Mantenimientos', summary: 'Cancelar un mantenimiento', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Maintenance }, rules: true },
  { method: 'post', path: '/maintenances/:id/attachments', tag: 'Mantenimientos', summary: 'Adjuntar un comprobante', description: 'PDF, JPG o PNG de hasta 1 MB.', roles: STAFF, params: idParamSchema, file: true, ok: { status: 201, data: Maintenance }, rules: true },
  { method: 'get', path: '/maintenances/:id/attachments/:attachmentId', tag: 'Mantenimientos', summary: 'Descargar un comprobante', roles: STAFF, params: attachmentParamsSchema, ok: { status: 200, file: true } },

  // --- Trips ---
  { method: 'get', path: '/trips', tag: 'Viajes', summary: 'Listar viajes', description: 'Un chofer solo ve los suyos. `search` busca en el destino y el nombre del chofer.', roles: ALL, query: listTripsQuerySchema, ok: { status: 200, page: Trip } },
  { method: 'get', path: '/trips/:id', tag: 'Viajes', summary: 'Ver un viaje', roles: ALL, params: idParamSchema, ok: { status: 200, data: Trip } },
  { method: 'post', path: '/trips', tag: 'Viajes', summary: 'Crear un viaje', description: 'El origen es fijo (RN-21) y la salida no puede ser anterior a hoy.', roles: STAFF, body: createTripSchema, ok: { status: 201, data: Trip }, rules: true },
  { method: 'patch', path: '/trips/:id', tag: 'Viajes', summary: 'Modificar un viaje pendiente', roles: STAFF, params: idParamSchema, body: updateTripSchema, ok: { status: 200, data: Trip }, rules: true },
  { method: 'post', path: '/trips/:id/assign', tag: 'Viajes', summary: 'Asignar chofer (el vehículo se elige solo)', description: 'Exige chofer activo, licencia vigente, documentación completa (RN-4) y sin otro viaje; toma el vehículo disponible con seguro vigente y menor kilometraje.', roles: STAFF, params: idParamSchema, body: assignTripSchema, ok: { status: 200, data: Trip }, rules: true },
  { method: 'post', path: '/trips/:id/finish', tag: 'Viajes', summary: 'Finalizar un viaje en curso', description: 'El kilometraje de llegada tiene que superar al de salida (RN-5).', roles: ALL, params: idParamSchema, body: finishTripSchema, ok: { status: 200, data: Trip }, rules: true },
  { method: 'post', path: '/trips/:id/cancel', tag: 'Viajes', summary: 'Cancelar un viaje pendiente', roles: STAFF, params: idParamSchema, ok: { status: 200, data: Trip }, rules: true },
  { method: 'delete', path: '/trips/:id', tag: 'Viajes', summary: 'Eliminar un viaje pendiente', roles: STAFF, params: idParamSchema, ok: { status: 204 }, rules: true },

  // --- Reports, alerts, audit, dashboard, settings ---
  { method: 'get', path: '/reports/trips', tag: 'Informes', summary: 'Informe de viajes de un período', description: 'Período máximo de 366 días.', roles: ADMIN, query: reportQuerySchema, ok: { status: 200, data: TripReport } },
  { method: 'get', path: '/alerts', tag: 'Alertas', summary: 'Listar alertas', roles: STAFF, query: listAlertsQuerySchema, ok: { status: 200, page: Alert } },
  { method: 'post', path: '/alerts/evaluate', tag: 'Alertas', summary: 'Evaluar las alertas ahora', description: 'También corre sola una vez al día, cada hora y al arrancar el servidor.', roles: ADMIN, ok: { status: 200, data: AlertEvaluation }, rules: true },
  { method: 'post', path: '/alerts/:id/resolve', tag: 'Alertas', summary: 'Resolver una alerta', roles: ADMIN, params: idParamSchema, ok: { status: 200, data: Alert }, rules: true },
  { method: 'get', path: '/audit-logs', tag: 'Auditoría', summary: 'Listar el registro de auditoría', roles: ADMIN, query: listAuditLogsQuerySchema, ok: { status: 200, page: AuditLog } },
  { method: 'get', path: '/dashboard', tag: 'Dashboard', summary: 'Métricas del tablero', roles: STAFF, ok: { status: 200, data: DashboardMetrics } },
  { method: 'get', path: '/settings', tag: 'Configuración', summary: 'Ver la configuración de la empresa', roles: ADMIN, ok: { status: 200, data: Settings } },
  { method: 'put', path: '/settings', tag: 'Configuración', summary: 'Modificar los datos de la empresa', description: 'La zona horaria, el idioma y el formato de fecha son fijos: incluirlos devuelve 400.', roles: ADMIN, body: updateSettingsSchema, ok: { status: 200, data: Settings } },
];

// ---------------------------------------------------------------------------
// Document generation
// ---------------------------------------------------------------------------

const toOpenApiPath = (path: string): string => `/api/v1${path.replace(/:(\w+)/g, '{$1}')}`;

function errorResponse(description: string) {
  return { description, content: { 'application/json': { schema: ErrorResponse } } };
}

function buildRegistry(): OpenAPIRegistry {
  const registry = new OpenAPIRegistry();
  const bearer = registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });

  for (const r of ROUTES) {
    const responses: Record<string, unknown> = {};
    if (r.ok.status === 204) {
      responses['204'] = { description: 'Sin contenido' };
    } else if (r.ok.file) {
      responses[String(r.ok.status)] = {
        description: 'El archivo (PDF, JPG o PNG)',
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      };
    } else {
      const data = r.ok.page
        ? z.object({ data: z.array(r.ok.page), meta: PaginationMeta })
        : z.object({ data: r.ok.data ?? z.unknown() });
      responses[String(r.ok.status)] = {
        description: r.ok.status === 201 ? 'Creado' : 'OK',
        content: { 'application/json': { schema: data } },
      };
    }
    if (r.params || r.query || r.body || r.file) responses['400'] = errorResponse('Datos inválidos');
    if (r.roles) {
      responses['401'] = errorResponse('Sin sesión o token vencido');
      responses['403'] = errorResponse('El rol no tiene permiso');
    } else if (r.path !== '/auth/logout') {
      responses['401'] = errorResponse('Credenciales o sesión inválidas');
    }
    if (r.path.includes('/:')) responses['404'] = errorResponse('No existe');
    if (r.rules) {
      responses['409'] = errorResponse('Conflicto con el estado actual (por ejemplo, un dato repetido)');
      responses['422'] = errorResponse('Una regla de negocio lo impide (el mensaje explica cuál)');
    }
    if (r.path === '/auth/login') responses['429'] = errorResponse('Demasiados intentos');

    const bodyContent = r.file
      ? {
          'multipart/form-data': {
            schema: (r.body instanceof z.ZodObject ? r.body : z.object({})).extend({
              file: z.string().openapi({ type: 'string', format: 'binary' }),
            }),
          },
        }
      : r.body
        ? { 'application/json': { schema: r.body } }
        : undefined;

    registry.registerPath({
      method: r.method,
      path: toOpenApiPath(r.path),
      tags: [r.tag],
      summary: r.summary,
      description: [r.description, r.roles ? `**Roles:** ${r.roles.join(', ')}.` : '**Público** (sin access token).']
        .filter(Boolean)
        .join('\n\n'),
      security: r.roles ? [{ [bearer.name]: [] }] : [],
      request: {
        ...(r.params ? { params: r.params as z.AnyZodObject } : {}),
        ...(r.query ? { query: r.query as z.AnyZodObject } : {}),
        ...(bodyContent ? { body: { content: bodyContent, required: true } } : {}),
      },
      responses: responses as never,
    });
  }
  return registry;
}

let cached: ReturnType<OpenApiGeneratorV3['generateDocument']> | null = null;

/** The OpenAPI document, generated once on first use. */
export function openApiDocument(): ReturnType<OpenApiGeneratorV3['generateDocument']> {
  cached ??= new OpenApiGeneratorV3(buildRegistry().definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Sistema de Gestión Logística y de Flota — API',
      version: '1.0.0',
      description:
        'API REST del trabajo práctico (UTN FRRo, Desarrollo de Software). Todas las respuestas usan `{ data }` ' +
        '(y `meta` en los listados paginados); los errores, `{ error: { code, message, details? } }`, con el mensaje en castellano.\n\n' +
        'Para probar los endpoints protegidos: `POST /api/v1/auth/login` con las credenciales del seed, copiar el `accessToken` ' +
        'y pegarlo en **Authorize**. Dura 15 minutos.',
    },
    servers: [{ url: '/' }],
  });
  return cached;
}
