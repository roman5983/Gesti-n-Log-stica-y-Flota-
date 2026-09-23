import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './database/prisma-client';
import { startAlertsScheduler, stopAlertsScheduler } from './modules/alerts/alerts.scheduler';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  if (env.NODE_ENV !== 'test') {
    startAlertsScheduler({ time: env.ALERTS_EVAL_TIME, timeZone: env.ALERTS_EVAL_TIMEZONE });
  }
});

/** Graceful shutdown: close HTTP first, then release DB connections. */
async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down...`);
  stopAlertsScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
