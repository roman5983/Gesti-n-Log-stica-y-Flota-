import { prisma } from '../../database/prisma-client';
import { ConflictError } from '../../shared/errors/app-error';
import { alertsService } from './alerts.service';

const STARTUP_DELAY_MS = 15_000;

let dailyTimer: NodeJS.Timeout | null = null;
let intervalTimer: NodeJS.Timeout | null = null;
let stopped = false;

/**
 * One pass: evaluate as the oldest active ADMIN (audit needs a real actor).
 *
 * Never rejects. It runs from a timer callback, where nothing awaits it: a
 * rejected promise there is an *unhandled* rejection, and Node's default is to
 * terminate the process. A transient MySQL failure (e.g. "pool timeout") must
 * cost one skipped evaluation, not the whole API — so every DB access,
 * including the actor lookup, lives inside the try.
 */
export async function runOnce(): Promise<void> {
  try {
    const actor = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true, deletedAt: null },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    if (!actor) return;

    const r = await alertsService.evaluate(actor.id);
    if (r.created > 0 || r.autoResolved > 0) {
      // eslint-disable-next-line no-console
      console.log(`[alerts-job] ${r.created} new, ${r.autoResolved} auto-resolved`);
    }
  } catch (err) {
    // Another instance holds the advisory lock: it is already doing the work.
    if (err instanceof ConflictError) return;
    // eslint-disable-next-line no-console
    console.error('[alerts-job] evaluation failed, will retry next interval:', err);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local wall-clock time of an instant in a timezone. */
function wallClock(now: Date, timeZone: string): { h: number; m: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { h: get('hour'), m: get('minute'), s: get('second') };
}

/**
 * Milliseconds from `now` until the next time the wall clock of `timeZone`
 * reads `time` ("HH:mm"). Always in (0, 24 h]: if it is exactly that time,
 * the next run is tomorrow's. Pure (and exported) so it can be tested with
 * fixed instants. On a DST change day the run may drift by the shift, once;
 * Argentina has no DST.
 */
export function msUntilNextRun(now: Date, time: string, timeZone: string): number {
  const [targetH, targetM] = time.split(':').map(Number) as [number, number];
  const { h, m, s } = wallClock(now, timeZone);
  const minutesAhead = (targetH * 60 + targetM - (h * 60 + m) + 24 * 60) % (24 * 60);
  const ms = minutesAhead * 60_000 - s * 1000 - now.getMilliseconds();
  return ms > 0 ? ms : ms + DAY_MS;
}

export interface AlertsScheduleConfig {
  /** "HH:mm" (24 h) of the daily run, or "off". */
  time: string;
  /** IANA timezone `time` refers to. */
  timeZone: string;
  /** Extra periodic pass, every this many minutes, on top of the daily one. 0/undefined disables it. */
  intervalMin?: number;
}

/**
 * Automatic alert evaluation: once a day at a fixed local time (P-AD-4:
 * expiries change by day, not by minute), plus one pass STARTUP_DELAY_MS after
 * the process starts. That startup pass matters on Render's free tier, where
 * the service sleeps when idle: whoever wakes it up gets alerts that are
 * current, even if the service was asleep at the daily time. On top of that,
 * an independent `intervalMin` timer re-runs the same evaluation through the
 * day (e.g. every hour), so time-sensitive alerts don't wait for the next
 * daily pass. The evaluation is idempotent (it reconciles against the
 * pending set), so overlapping passes from either timer never duplicate
 * alerts. "Evaluar alertas" (POST /alerts/evaluate) still runs it on demand
 * at any time.
 *
 * Both timers are chained setTimeout, re-armed in `finally` after every pass:
 * a failed pass does not stop the job. unref'd so neither keeps the process
 * alive on shutdown.
 */
export function startAlertsScheduler(config: AlertsScheduleConfig): void {
  if (dailyTimer || intervalTimer) return;
  stopped = false;
  const daily = config.time !== 'off';
  const intervalMin = config.intervalMin ?? 0;

  const scheduleDaily = (delay: number) => {
    if (stopped) return;
    dailyTimer = setTimeout(async () => {
      try {
        await runOnce();
      } catch (err) {
        // runOnce already swallows its errors; this is a last line of defence
        // so no future change to it can take the process down.
        // eslint-disable-next-line no-console
        console.error('[alerts-job] unexpected error:', err);
      } finally {
        if (daily) scheduleDaily(msUntilNextRun(new Date(), config.time, config.timeZone));
        else dailyTimer = null;
      }
    }, delay);
    dailyTimer.unref();
  };
  scheduleDaily(STARTUP_DELAY_MS);

  if (intervalMin > 0) {
    const intervalMs = intervalMin * 60_000;
    const scheduleInterval = (delay: number) => {
      if (stopped) return;
      intervalTimer = setTimeout(async () => {
        try {
          await runOnce();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[alerts-job] unexpected error:', err);
        } finally {
          scheduleInterval(intervalMs);
        }
      }, delay);
      intervalTimer.unref();
    };
    scheduleInterval(intervalMs);
  }
}

export function stopAlertsScheduler(): void {
  stopped = true;
  if (dailyTimer) clearTimeout(dailyTimer);
  if (intervalTimer) clearTimeout(intervalTimer);
  dailyTimer = null;
  intervalTimer = null;
}
