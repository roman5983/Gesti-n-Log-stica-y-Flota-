/** Project-wide constants derived from the functional document. */

/** F-9: maximum attachment size — 1 MB. */
export const MAX_FILE_SIZE_BYTES = 1024 * 1024;

/** Allowed upload formats (DOC-5): PDF, JPG, PNG. */
export const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

/** Root folder for uploaded files (metadata lives in the DB; files on disk). */
export const UPLOAD_ROOT = 'uploads';

/** A-12 / RN-17: expiry alerts fire two weeks before the due date. */
export const EXPIRY_ALERT_LEAD_DAYS = 14;

/** RN-21: fixed origin for every trip. */
export const FIXED_TRIP_ORIGIN =
  'Ciudad Industria, Autopista Córdoba - Rosario, Rosario, Santa Fe';
