/** Project-wide constants derived from the functional document. */

/** F-9: maximum attachment size — 1 MB. */
export const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/** Allowed upload formats (DOC-5): PDF, JPG, PNG. */
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** A-12 / RN-17: expiry alerts fire two weeks before the due date. */
export const EXPIRY_ALERT_LEAD_DAYS = 14;

/** VOYAGE_NOT_ASSIGNED: a pending trip leaving within this window raises an alert (1 h). */
export const UNASSIGNED_TRIP_LEAD_MS = 60 * 60 * 1000;

/** RN-21: fixed origin for every trip. */
export const FIXED_TRIP_ORIGIN =
  'Ciudad Industria, Autopista Córdoba - Rosario, Rosario, Santa Fe';
