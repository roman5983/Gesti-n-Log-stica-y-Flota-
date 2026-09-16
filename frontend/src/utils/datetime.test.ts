import { describe, it, expect } from 'vitest';
import { formatDateOnly, isoToLocalInput, localInputToIso } from './datetime';

describe('datetime helpers (datetime-local ↔ ISO)', () => {
  it('round-trips a local input value without drift', () => {
    // A value the user typed in the local datetime-local input.
    const input = '2026-08-01T08:00';
    const iso = localInputToIso(input);
    // Re-deriving the input from the ISO gives back the same local value.
    expect(isoToLocalInput(iso)).toBe(input);
  });

  it('localInputToIso produces a valid ISO instant', () => {
    const iso = localInputToIso('2026-08-01T08:00');
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('isoToLocalInput reflects the local wall-clock time of the instant', () => {
    // Build an instant, convert to local input, and back — stable.
    const original = new Date('2026-12-25T15:30:00.000Z');
    const input = isoToLocalInput(original.toISOString());
    expect(localInputToIso(input)).toBe(original.toISOString());
  });
});

describe('formatDateOnly (@db.Date fields)', () => {
  it('keeps the calendar day the backend stored, whatever the browser timezone', () => {
    // Regression guard. These arrive as UTC midnight because the columns carry
    // no time; formatting them in local time west of Greenwich (Argentina is
    // UTC-3) rolls back to the previous day, so a licence expiring on the 15th
    // used to render as the 14th.
    for (const iso of [
      '2026-01-01T00:00:00.000Z',
      '2026-03-15T00:00:00.000Z',
      '2026-12-31T00:00:00.000Z',
    ]) {
      const [day, month, year] = formatDateOnly(iso).split('/').map(Number);
      const expected = new Date(iso);
      expect(day).toBe(expected.getUTCDate());
      expect(month).toBe(expected.getUTCMonth() + 1);
      expect(year).toBe(expected.getUTCFullYear());
    }
  });

  it('formats in es-AR day/month/year order', () => {
    expect(formatDateOnly('2026-03-15T00:00:00.000Z')).toBe('15/3/2026');
  });
});
