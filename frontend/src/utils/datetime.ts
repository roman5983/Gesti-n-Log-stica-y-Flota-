/**
 * Helpers to bridge an ISO instant and the value of an <input type="datetime-local">.
 *
 * A datetime-local input has NO timezone: its value is "YYYY-MM-DDTHH:mm" in
 * the user's local wall-clock time. Slicing an ISO string mixes UTC digits
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
