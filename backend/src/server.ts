import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './database/prisma-client';

const app = createApp();

// 0.0.0.0 is required by container platforms (Railway/Render/Docker):
// binding to loopback would make the app unreachable from the proxy.
const server = app.listen(env.PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${env.PORT} (${env.NODE_ENV})`);
});

/** Graceful shutdown: close HTTP first, then release DB connections. */
async function shutdown(signal: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
