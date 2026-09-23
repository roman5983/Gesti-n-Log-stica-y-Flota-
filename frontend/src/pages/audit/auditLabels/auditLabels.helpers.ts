import { formatDateOnly, formatDateTime } from '@/utils/datetime';
import type { AuditChipColor } from './auditLabels.types';
import { REDACTED, EMPTY_VALUE } from './auditLabels.const';
import { ACTION_LABELS, ACTION_COLORS, ENTITY_LABELS, FIELD_LABELS, SHARED_VALUE_LABELS, STATUS_BY_ENTITY, FALLBACK_STATUS, DATE_ONLY_FIELDS, DATE_TIME_FIELDS, KM_FIELDS, ID_FIELDS } from './auditLabels.data';

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

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

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
