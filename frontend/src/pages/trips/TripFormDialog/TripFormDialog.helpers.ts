/** Today at local midnight, as a 'YYYY-MM-DDTHH:mm' local value (the DateTimeField format). */
export function todayLocalInputMin(): string {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return `${midnight.getFullYear()}-${String(midnight.getMonth() + 1).padStart(2, '0')}-${String(midnight.getDate()).padStart(2, '0')}T00:00`;
}
