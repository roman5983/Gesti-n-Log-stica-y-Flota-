import { defineConfig } from 'vitest/config';

/**
 * Integration tests: the real Express app (supertest) against a real MySQL
 * database. Run with `npm run test:integration`.
 *
 * They need TEST_DATABASE_URL pointing to a database whose name ends in
 * `_test` (for example `.../logistics_management_test`): every file wipes it
 * before starting, so it must never be the development database. The global
 * setup applies the migrations (`prisma migrate deploy`) before the run.
 *
 * Files run one after another (they share the database) and each test waits
 * up to 30 s, because the concurrency tests fire requests in parallel.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/integration/**/*.int.test.ts'],
    globalSetup: ['test/integration/global-setup.ts'],
    setupFiles: ['test/integration/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
