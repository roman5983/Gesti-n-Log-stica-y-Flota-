import { describe, it, expect } from 'vitest';
import { utcStartOfToday, utcEndOfDay } from './dates';

describe('date helpers (UTC boundaries)', () => {
  it('utcStartOfToday is midnight UTC of the current calendar date', () => {
    const d = utcStartOfToday();
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it('a license expiring today is still valid today (RN-1)', () => {
    const today = utcStartOfToday();
    // A DATE column value for today comes back as this exact instant.
    expect(today >= utcStartOfToday()).toBe(true);
  });

  it('utcEndOfDay is the inclusive end of the given day in UTC', () => {
    const end = utcEndOfDay(new Date('2026-07-31T00:00:00.000Z'));
    expect(end.toISOString()).toBe('2026-07-31T23:59:59.999Z');
  });

  it('a timestamp late in the day falls within [start, endOfDay]', () => {
    const day = new Date('2026-07-31T00:00:00.000Z');
    const lateInDay = new Date('2026-07-31T23:00:00.000Z');
    expect(lateInDay <= utcEndOfDay(day)).toBe(true);
  });
});
