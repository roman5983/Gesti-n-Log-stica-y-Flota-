import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msUntilNextRun, runOnce, startAlertsScheduler, stopAlertsScheduler } from './alerts.scheduler';

// The scheduler only touches the DB through these two modules; mocking them
// lets the test simulate MySQL going down without a database.
const { findFirst, evaluate } = vi.hoisted(() => ({ findFirst: vi.fn(), evaluate: vi.fn() }));

vi.mock('../../database/prisma-client', () => ({ prisma: { user: { findFirst } } }));
vi.mock('./alerts.service', () => ({ alertsService: { evaluate } }));

describe('alerts scheduler', () => {
  beforeEach(() => {
    findFirst.mockReset();
    evaluate.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    stopAlertsScheduler();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not reject when the database fails (it would crash the process)', async () => {
    findFirst.mockRejectedValue(new Error('pool timeout'));
    await expect(runOnce()).resolves.toBeUndefined();
    expect(evaluate).not.toHaveBeenCalled();
  });

  it('keeps running after a failed pass: next try at the daily time', async () => {
    vi.useFakeTimers();
    // 05:00 in Buenos Aires (UTC-3) = 08:00 UTC.
    vi.setSystemTime(new Date('2026-09-23T08:00:00.000Z'));
    // First pass: MySQL down. Second pass: back up.
    findFirst.mockRejectedValueOnce(new Error('pool timeout')).mockResolvedValue({ id: 1 });
    evaluate.mockResolvedValue({ evaluated: 0, created: 0, autoResolved: 0 });

    startAlertsScheduler({ time: '06:00', timeZone: 'America/Argentina/Buenos_Aires' });

    await vi.advanceTimersByTimeAsync(15_000); // startup delay → first (failed) pass
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(evaluate).not.toHaveBeenCalled();

    // Nothing in between: the next run is the daily one, not every few minutes.
    await vi.advanceTimersByTimeAsync(59 * 60_000);
    expect(findFirst).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000); // 06:00 local → recovered pass
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenCalledWith(1);

    // And then exactly one day later.
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000);
    expect(findFirst).toHaveBeenCalledTimes(3);
  });

  it('with "off" only the startup pass runs', async () => {
    vi.useFakeTimers();
    findFirst.mockResolvedValue({ id: 1 });
    evaluate.mockResolvedValue({ evaluated: 0, created: 0, autoResolved: 0 });

    startAlertsScheduler({ time: 'off', timeZone: 'America/Argentina/Buenos_Aires' });
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(3 * 24 * 60 * 60_000);
    expect(evaluate).toHaveBeenCalledTimes(1);
  });
});

describe('msUntilNextRun (daily time in the company timezone)', () => {
  const BA = 'America/Argentina/Buenos_Aires'; // UTC-3, no DST
  const HOUR = 60 * 60_000;

  it('later the same day', () => {
    // 05:00 local → 06:00 local is 1 h away.
    expect(msUntilNextRun(new Date('2026-09-23T08:00:00.000Z'), '06:00', BA)).toBe(HOUR);
  });

  it('already past today → tomorrow', () => {
    // 07:30 local → next 06:00 is 22.5 h away.
    expect(msUntilNextRun(new Date('2026-09-23T10:30:00.000Z'), '06:00', BA)).toBe(22.5 * HOUR);
  });

  it('exactly at the time → the next day, never 0', () => {
    expect(msUntilNextRun(new Date('2026-09-23T09:00:00.000Z'), '06:00', BA)).toBe(24 * HOUR);
  });

  it('counts seconds and milliseconds', () => {
    // 05:59:30.250 local → 29.75 s left.
    expect(msUntilNextRun(new Date('2026-09-23T08:59:30.250Z'), '06:00', BA)).toBe(29_750);
  });

  it('uses the given timezone, not the server one', () => {
    // Same instant, 06:00 UTC is 3 h after 03:00 UTC.
    expect(msUntilNextRun(new Date('2026-09-23T03:00:00.000Z'), '06:00', 'UTC')).toBe(3 * HOUR);
  });
});
