import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-database';

/**
 * Runs once before the integration suite: brings the test database schema up
 * to date with the same migrations production uses (`migrate deploy`, which
 * also creates the database if it doesn't exist).
 */
export default function setup(): void {
  const url = testDatabaseUrl();
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}
