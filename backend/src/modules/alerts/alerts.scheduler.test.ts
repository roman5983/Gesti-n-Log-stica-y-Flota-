import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runOnce, startAlertsScheduler, stopAlertsScheduler } from './alerts.scheduler';

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

  it('keeps running after a failed pass', async () => {
    vi.useFakeTimers();
    // First pass: MySQL down. Second pass: back up.
    findFirst.mockRejectedValueOnce(new Error('pool timeout')).mockResolvedValue({ id: 1 });
    evaluate.mockResolvedValue({ evaluated: 0, created: 0, autoResolved: 0 });

    startAlertsScheduler(1);

    await vi.advanceTimersByTimeAsync(15_000); // startup delay → first (failed) pass
    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(evaluate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000); // one interval later → recovered pass
    expect(findFirst).toHaveBeenCalledTimes(2);
    expect(evaluate).toHaveBeenCalledWith(1);
  });
});
