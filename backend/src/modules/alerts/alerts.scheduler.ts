import { prisma } from '../../database/prisma-client';
import { ConflictError } from '../../shared/errors/app-error';
import { alertsService } from './alerts.service';

const STARTUP_DELAY_MS = 15_000;

let timer: NodeJS.Timeout | null = null;
let stopped = false;

/** One pass: evaluate as the oldest active ADMIN (audit needs a real actor). */
async function runOnce(): Promise<void> {
  const actor = await prisma.user.findFirst({
    where: { role: 'ADMIN', isActive: true, deletedAt: null },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (!actor) return;

  try {
    const r = await alertsService.evaluate(actor.id);
    if (r.created > 0 || r.autoResolved > 0) {
      // eslint-disable-next-line no-console
      console.log(`[alerts-job] ${r.created} new, ${r.autoResolved} auto-resolved`);
    }
  } catch (err) {
    // Another instance holds the advisory lock: it is already doing the work.
    if (err instanceof ConflictError) return;
    // eslint-disable-next-line no-console
    console.error('[alerts-job] evaluation failed:', err);
  }
}

/**
 * Periodic alert evaluation. Chained setTimeout (not setInterval) so a slow
 * run can never overlap the next one; unref'd so it never keeps the process
 * alive on shutdown.
 */
export function startAlertsScheduler(intervalMin: number): void {
  if (intervalMin <= 0 || timer) return;
  stopped = false;
  const intervalMs = intervalMin * 60_000;

  const schedule = (delay: number) => {
    if (stopped) return;
    timer = setTimeout(async () => {
      await runOnce();
      schedule(intervalMs);
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
