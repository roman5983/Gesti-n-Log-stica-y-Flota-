/**
 * Date helpers for DATE columns.
 *
 * MySQL DATE columns come back from Prisma as midnight UTC of the calendar
 * date (e.g. 2026-07-15 → 2026-07-15T00:00:00Z). To compare them against
 * "today" the reference must ALSO be midnight UTC of the local calendar
 * date — building local midnight would shift the boundary by the timezone
 * offset (UTC-3 in Argentina) and make a license expiring today read as
 * already expired (violating RN-1: valid through its expiry date).
 */
export function utcStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * End of the given calendar day in UTC (23:59:59.999). Used as an inclusive
 * upper bound for date-range queries, coherent with how DATE values and
 * date query params are parsed as UTC midnight — building local end-of-day
 * would shift the boundary by the server's timezone offset (e.g. in UTC-3,
 * "to July 31" would end at 2026-07-31T02:59Z and drop most of that day).
 */
export function utcEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}
