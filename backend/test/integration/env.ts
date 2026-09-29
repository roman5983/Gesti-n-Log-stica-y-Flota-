import { testDatabaseUrl } from './test-database';

/**
 * Runs in each test file BEFORE the app is imported: the Prisma client reads
 * DATABASE_URL when its module loads, so it has to point at the test
 * database by then. NODE_ENV=test keeps the alerts scheduler off.
 */
process.env['DATABASE_URL'] = testDatabaseUrl();
process.env['NODE_ENV'] = 'test';
