/**
 * Helpers to bridge an ISO instant and the value of a DateTimeField
 * (components/DateField.tsx), the same shape the native datetime-local input
 * used before it.
 *
 * That value has NO timezone: it is "YYYY-MM-DDTHH:mm" in the user's local
 * wall-clock time. Slicing an ISO string mixes UTC digits
 * with a local interpretation and shifts the time by the timezone offset.
 * These functions convert through the Date object so the local wall-clock
 * time stays consistent between create, edit and the list view.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO instant → datetime-local value in local time. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value (local time) → ISO instant (UTC), unambiguous for the API. */
export function localInputToIso(value: string): string {
  // `new Date("YYYY-MM-DDTHH:mm")` parses as LOCAL time; toISOString() → UTC.
  return new Date(value).toISOString();
}

/**
 * Formats a *date-only* field (Prisma `@db.Date`: license/insurance/document
 * expiry) for display.
 *
 * Those columns carry no time, so Prisma serializes them as UTC midnight
 * ("2026-03-15T00:00:00.000Z"). Rendering that with a plain
 * `toLocaleDateString()` in Argentina (UTC-3) walks the clock back three hours
 * and shows the *previous* day — a licence expiring on 15/03 reads as 14/03.
 * Reading the parts back in UTC keeps the calendar day the backend stored.
 *
 * Only for date-only fields: real instants (departureAt, scheduledAt,
 * occurredAt) must stay in local time.
 */
export function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

/** Formats a true instant (date + time) in the user's local timezone. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR');
}

/**
 * Formats a true instant as its *local* calendar day, without the time
 * (e.g. when a maintenance was scheduled, when a trip finished).
 *
 * Not interchangeable with formatDateOnly: that one reads the parts in UTC for
 * `@db.Date` columns. Applied to an instant, UTC would show 23:30 local time
 * on the 14th as the 15th.
 */
export function formatLocalDate(iso: string, options?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString('es-AR', options);
}

/**
 * Short, human reference to a recent instant in local time: "Hoy 10:32",
 * "Ayer 17:42", and the full date for anything older (alert cards).
 * `now` is injectable for tests.
 */
export function formatRelativeDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (days === 0) return `Hoy ${time}`;
  if (days === 1) return `Ayer ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
}
