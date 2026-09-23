import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/**
 * Value contract of the date inputs (components/DateField.tsx).
 *
 * Forms and filters keep dates as plain strings, in the same shape the
 * native inputs used to produce, so the API calls did not have to change:
 *  - 'date'     → 'YYYY-MM-DD'        (calendar day; @db.Date columns, filters)
 *  - 'dateTime' → 'YYYY-MM-DDTHH:mm'  (local wall-clock time; converted to a
 *                                      UTC instant with localInputToIso)
 * '' means empty. What the user sees and types is dd/mm/aaaa (hh:mm).
 */
export type DateInputKind = 'date' | 'dateTime';

export const VALUE_FORMAT: Record<DateInputKind, string> = {
  date: 'YYYY-MM-DD',
  dateTime: 'YYYY-MM-DDTHH:mm',
};

export const DISPLAY_FORMAT: Record<DateInputKind, string> = {
  date: 'DD/MM/YYYY',
  dateTime: 'DD/MM/YYYY HH:mm',
};

const PLACEHOLDER: Record<DateInputKind, string> = {
  date: 'dd/mm/aaaa',
  dateTime: 'dd/mm/aaaa hh:mm',
};

/**
 * Plausible years. Besides bounding the calendar, this is what tells a date
 * being typed from a finished one: the picker fills the year digit by digit
 * (15/03/0002 → 0020 → 0202 → 2027), and every step is a *valid* date.
 * Without this bound, those intermediate years reached the filters and fired
 * requests for the year 202.
 */
export const MIN_YEAR = 1900;
export const MAX_YEAR = 2099;

/** Parse a stored value ('' or malformed → null). Strict: no guessing. */
export function parseDateInput(value: string, kind: DateInputKind): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, VALUE_FORMAT[kind], true);
  return parsed.isValid() ? parsed : null;
}

/** A date the user has finished entering: valid and with a plausible year. */
export function isCompleteDate(date: Dayjs | null): date is Dayjs {
  return date !== null && date.isValid() && date.year() >= MIN_YEAR && date.year() <= MAX_YEAR;
}

/**
 * What the input reports to its parent for what the picker holds now:
 *  - null (every section empty)  → '' (cleared)
 *  - a finished date             → its value string
 *  - anything in between         → undefined: still being typed or invalid.
 *    Nothing is reported, so the parent keeps its last good value instead of
 *    flickering to '' (or to year 202) on every keystroke.
 */
export function serializeDateInput(date: Dayjs | null, kind: DateInputKind): string | undefined {
  if (date === null) return '';
  return isCompleteDate(date) ? date.format(VALUE_FORMAT[kind]) : undefined;
}

export interface DateInputRules {
  required?: boolean;
  /** Earliest allowed calendar day, 'YYYY-MM-DD' (inclusive). */
  minDate?: string;
  /** Latest allowed calendar day, 'YYYY-MM-DD' (inclusive). */
  maxDate?: string;
}

/** Validation message in Spanish, or null when the value is acceptable. */
export function dateInputError(
  date: Dayjs | null,
  kind: DateInputKind,
  { required = false, minDate, maxDate }: DateInputRules,
): string | null {
  if (date === null) return required ? 'Completá la fecha' : null;
  if (!isCompleteDate(date)) return `Fecha incompleta o inválida (${PLACEHOLDER[kind]})`;
  const min = parseDateInput(minDate ?? '', 'date');
  if (min && date.isBefore(min, 'day')) return `No puede ser anterior al ${min.format('DD/MM/YYYY')}`;
  const max = parseDateInput(maxDate ?? '', 'date');
  if (max && date.isAfter(max, 'day')) return `No puede ser posterior al ${max.format('DD/MM/YYYY')}`;
  return null;
}
