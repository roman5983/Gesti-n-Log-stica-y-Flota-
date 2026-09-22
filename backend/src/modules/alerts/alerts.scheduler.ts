import { prisma } from '../../database/prisma-client';
import { ConflictError } from '../../shared/errors/app-error';
import { alertsService } from './alerts.service';

const STARTUP_DELAY_MS = 15_000;

let timer: NodeJS.Timeout | null = null;
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

/**
 * Periodic alert evaluation. Chained setTimeout (not setInterval) so a slow
 * run can never overlap the next one; unref'd so it never keeps the process
 * alive on shutdown. The next run is scheduled in `finally`, so the job keeps
 * going after a failed pass instead of silently stopping.
 */
export function startAlertsScheduler(intervalMin: number): void {
  if (intervalMin <= 0 || timer) return;
  stopped = false;
  const intervalMs = intervalMin * 60_000;

  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(async () => {
      try {
        await runOnce();
      } catch (err) {
        // runOnce already swallows its errors; this is a last line of defence
        // so no future change to it can take the process down.
        // eslint-disable-next-line no-console
        console.error('[alerts-job] unexpected error:', err);
      } finally {
        schedule(intervalMs);
      }
    }, delay);
    timer.unref();
  };
  schedule(STARTUP_DELAY_MS);
}

export function stopAlertsScheduler(): void {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}
