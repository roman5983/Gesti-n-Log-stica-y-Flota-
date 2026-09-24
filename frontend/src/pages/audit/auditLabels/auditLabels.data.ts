import type { AuditChipColor } from './auditLabels.types';

/** Actions, in the order they are offered in the filter. */
export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'ACTIVATE',
  'DEACTIVATE',
  'ASSIGN',
  'FINISH',
  'CANCEL',
  'RESOLVE',
  'VIEW_CREDENTIALS',
] as const;

export const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Creación',
  UPDATE: 'Modificación',
  DELETE: 'Eliminación',
  ACTIVATE: 'Activación',
  DEACTIVATE: 'Desactivación',
  ASSIGN: 'Asignación',
  FINISH: 'Finalización',
  CANCEL: 'Cancelación',
  RESOLVE: 'Resolución',
  VIEW_CREDENTIALS: 'Consulta de credenciales',
};

/** Colors carry meaning here: destructive actions read red, the sensitive
 *  credentials read stands out in amber, routine changes stay neutral. */
export const ACTION_COLORS: Record<string, AuditChipColor> = {
  CREATE: 'success',
  UPDATE: 'info',
  DELETE: 'error',
  ACTIVATE: 'success',
  DEACTIVATE: 'warning',
  ASSIGN: 'info',
  FINISH: 'success',
  CANCEL: 'warning',
  RESOLVE: 'success',
  VIEW_CREDENTIALS: 'warning',
};

/** Entities, in the order they are offered in the filter. */
export const AUDIT_ENTITIES = [
  'USER',
  'DRIVER',
  'VEHICLE',
  'TRIP',
  'MAINTENANCE',
  'MAINTENANCE_TYPE',
  'DRIVER_DOCUMENT',
  'ALERT',
  'COMPANY_SETTINGS',
] as const;

export const ENTITY_LABELS: Record<string, string> = {
  USER: 'Usuario',
  DRIVER: 'Chofer',
  VEHICLE: 'Vehículo',
  TRIP: 'Viaje',
  MAINTENANCE: 'Mantenimiento',
  MAINTENANCE_TYPE: 'Tipo de mantenimiento',
  DRIVER_DOCUMENT: 'Documento de chofer',
  ALERT: 'Alerta',
  COMPANY_SETTINGS: 'Configuración de la empresa',
};

/** Field keys emitted by the backend audit snapshots, in Spanish. */
export const FIELD_LABELS: Record<string, string> = {
  // Users / drivers
  name: 'Nombre',
  email: 'Email',
  role: 'Rol',
  isActive: 'Activo',
  passwordChanged: 'Contraseña modificada',
  dni: 'DNI',
  licenseCategory: 'Categoría de licencia',
  licenseExpiryDate: 'Vencimiento de licencia',
  // Vehicles
  licensePlate: 'Patente',
  model: 'Modelo',
  year: 'Año',
  initialKm: 'Km inicial',
  accumulatedKm: 'Km acumulado',
  insuranceExpiryDate: 'Vencimiento del seguro',
  status: 'Estado',
  vehicleStatus: 'Estado del vehículo',
  // Trips
  destination: 'Destino',
  departureAt: 'Fecha de salida',
  arrivalKm: 'Km de llegada',
  driverId: 'Chofer',
  vehicleId: 'Vehículo',
  // Maintenance
  maintenanceTypeId: 'Tipo de mantenimiento',
  scheduledAt: 'Fecha programada',
  km: 'Kilometraje',
  attachmentAdded: 'Comprobante adjuntado',
  description: 'Descripción',
  kmAlert: 'Km de aviso',
  kmTarget: 'Km objetivo',
  monthsAlert: 'Meses de aviso',
  monthsTarget: 'Meses objetivo',
  // Documents
  documentType: 'Tipo de documento',
  expiryDate: 'Vencimiento',
  // Alerts
  alertType: 'Tipo de alerta',
  evaluated: 'Condiciones evaluadas',
  created: 'Alertas creadas',
  autoResolved: 'Alertas auto-resueltas',
  // Company settings
  companyName: 'Razón social',
  taxId: 'CUIT',
  address: 'Dirección',
  phone: 'Teléfono',
  timezone: 'Zona horaria',
  language: 'Idioma',
  dateFormat: 'Formato de fecha',
  updatedAt: 'Última modificación',
};

/** Enum values that mean the same thing regardless of the entity. */
export const SHARED_VALUE_LABELS: Record<string, string> = {
  // Roles
  ADMIN: 'Administrador',
  OPERATOR: 'Operador',
  DRIVER: 'Chofer',
  // Vehicle status
  AVAILABLE: 'Disponible',
  INACTIVE: 'Inactivo',
  IN_WORKSHOP: 'En taller',
  ON_TRIP: 'En viaje',
  // Trip status
  PENDING_ASSIGNMENT: 'Pendiente de asignación',
  // Document types
  DNI: 'DNI',
  LICENSE: 'Licencia de conducir',
  ART: 'ART',
  PSYCHOPHYSICAL: 'Psicofísico',
  // Alert types
  LICENSE_EXPIRING: 'Licencia por vencer',
  LICENSE_EXPIRED: 'Licencia vencida',
  DOCUMENT_EXPIRING: 'Documento por vencer',
  DOCUMENT_EXPIRED: 'Documento vencido',
  INSURANCE_EXPIRING: 'Seguro por vencer',
  INSURANCE_EXPIRED: 'Seguro vencido',
  MAINTENANCE_KM_EXCEEDED: 'Km de mantenimiento superado',
  VEHICLE_INACTIVE: 'Vehículo inactivo',
  RESOLVED: 'Resuelta',
  VOYAGE_NOT_ASSIGNED: 'Viaje no asignado',
};

/**
 * `IN_PROGRESS`, `COMPLETED` and `PENDING` are reused by trips, maintenances
 * and alerts with different wording in Spanish, so they are resolved with the
 * entity as context instead of a single global map.
 */
export const STATUS_BY_ENTITY: Record<string, Record<string, string>> = {
  TRIP: { IN_PROGRESS: 'En viaje', COMPLETED: 'Finalizado', PENDING: 'Pendiente', CANCELLED: 'Cancelado' },
  MAINTENANCE: { IN_PROGRESS: 'En curso', COMPLETED: 'Completado', PENDING: 'Pendiente', CANCELLED: 'Cancelado' },
  ALERT: { PENDING: 'Pendiente', RESOLVED: 'Resuelta' },
};

export const FALLBACK_STATUS: Record<string, string> = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelado',
};

/** Date-only columns (`@db.Date`): must be read back in UTC, see formatDateOnly. */
export const DATE_ONLY_FIELDS = new Set(['licenseExpiryDate', 'insuranceExpiryDate', 'expiryDate']);

/** True instants: shown in the reader's local time. */
export const DATE_TIME_FIELDS = new Set(['departureAt', 'scheduledAt', 'updatedAt']);

/** Numbers that represent kilometers. */
export const KM_FIELDS = new Set(['initialKm', 'accumulatedKm', 'arrivalKm', 'km', 'kmAlert', 'kmTarget']);

/** Foreign keys: the snapshot only carries the id, so it is shown as "#id"
 *  rather than pretending to know the driver's or vehicle's name. */
export const ID_FIELDS = new Set(['driverId', 'vehicleId', 'maintenanceTypeId']);
