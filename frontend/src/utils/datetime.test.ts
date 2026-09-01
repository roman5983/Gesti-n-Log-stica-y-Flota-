import { describe, it, expect } from 'vitest';
import { isoToLocalInput, localInputToIso } from './datetime';

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
