import { formatDateOnly, formatDateTime } from '../../utils/datetime';

/**
 * Spanish vocabulary for the audit trail (P-AD-3).
 *
 * The backend stores actions, entities and snapshot payloads with their
 * internal English codes (CREATE / VEHICLE / licensePlate) — that is correct
 * for an immutable log and must not change. Translation belongs here, at the
 * edge, so the admin reading the screen never sees an internal code.
 *
 * Every map falls back to the raw code instead of blanking out: a new action
 * added in the backend shows up untranslated but still legible, rather than
 * disappearing from the UI.
 */

export type AuditChipColor = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

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

const ACTION_LABELS: Record<string, string> = {
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
const ACTION_COLORS: Record<string, AuditChipColor> = {
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

const ENTITY_LABELS: Record<string, string> = {
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

export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code;
}

export function actionColor(code: string): AuditChipColor {
  return ACTION_COLORS[code] ?? 'default';
}

export function entityLabel(code: string): string {
  return ENTITY_LABELS[code] ?? code;
}

/** Entity + id as shown in the table ("Vehículo #12"). */
export function entityWithId(entity: string, entityId: number | null): string {
  return entityId != null ? `${entityLabel(entity)} #${entityId}` : entityLabel(entity);
}

// ---------------------------------------------------------------------------
// Snapshot fields
// ---------------------------------------------------------------------------

/** Field keys emitted by the backend audit snapshots, in Spanish. */
const FIELD_LABELS: Record<string, string> = {
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

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

/** Enum values that mean the same thing regardless of the entity. */
const SHARED_VALUE_LABELS: Record<string, string> = {
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
};

/**
 * `IN_PROGRESS`, `COMPLETED` and `PENDING` are reused by trips, maintenances
 * and alerts with different wording in Spanish, so they are resolved with the
 * entity as context instead of a single global map.
 */
const STATUS_BY_ENTITY: Record<string, Record<string, string>> = {
  TRIP: { IN_PROGRESS: 'En viaje', COMPLETED: 'Finalizado', PENDING: 'Pendiente', CANCELLED: 'Cancelado' },
  MAINTENANCE: { IN_PROGRESS: 'En curso', COMPLETED: 'Completado', PENDING: 'Pendiente', CANCELLED: 'Cancelado' },
  ALERT: { PENDING: 'Pendiente', RESOLVED: 'Resuelta' },
};

const FALLBACK_STATUS: Record<string, string> = {
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  PENDING: 'Pendiente',
  CANCELLED: 'Cancelado',
};

/** Date-only columns (`@db.Date`): must be read back in UTC, see formatDateOnly. */
const DATE_ONLY_FIELDS = new Set(['licenseExpiryDate', 'insuranceExpiryDate', 'expiryDate']);
/** True instants: shown in the reader's local time. */
const DATE_TIME_FIELDS = new Set(['departureAt', 'scheduledAt', 'updatedAt']);
/** Numbers that represent kilometers. */
const KM_FIELDS = new Set(['initialKm', 'accumulatedKm', 'arrivalKm', 'km', 'kmAlert', 'kmTarget']);
/** Foreign keys: the snapshot only carries the id, so it is shown as "#id"
 *  rather than pretending to know the driver's or vehicle's name. */
const ID_FIELDS = new Set(['driverId', 'vehicleId', 'maintenanceTypeId']);

/** Placeholder written by the backend over sensitive fields before storing. */
const REDACTED = '[REDACTED]';

/** Shown when a field has no value on one side of the comparison. */
export const EMPTY_VALUE = '—';

function translateEnum(value: string, entity: string): string {
  const byEntity = STATUS_BY_ENTITY[entity]?.[value];
  if (byEntity) return byEntity;
  return SHARED_VALUE_LABELS[value] ?? FALLBACK_STATUS[value] ?? value;
}

/**
 * Renders one snapshot value for a human reader.
 * `entity` disambiguates status enums shared across modules.
 */
export function formatAuditValue(key: string, value: unknown, entity: string): string {
  if (value === null || value === undefined || value === '') return EMPTY_VALUE;
  if (value === REDACTED) return 'Oculto por seguridad';

  if (typeof value === 'boolean') return value ? 'Sí' : 'No';

  if (typeof value === 'number') {
    if (KM_FIELDS.has(key)) return `${value.toLocaleString('es-AR')} km`;
    if (ID_FIELDS.has(key)) return `#${value}`;
    if (key === 'year') return String(value); // a year is not a thousands-separated number
    return value.toLocaleString('es-AR');
  }

  if (typeof value === 'string') {
    if (DATE_ONLY_FIELDS.has(key)) return formatDateOnly(value);
    if (DATE_TIME_FIELDS.has(key)) return formatDateTime(value);
    return translateEnum(value, entity);
  }

  // Nested objects are rare in snapshots; show them rather than hide them.
  return JSON.stringify(value);
}
