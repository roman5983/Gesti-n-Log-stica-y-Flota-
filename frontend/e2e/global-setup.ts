import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { e2eDatabaseUrl } from './test-env';

/**
 * Before every run: bring the test database up to date and load the demo
 * data (the seed resets it), so every run starts from the same state.
 */
export default function globalSetup(): void {
  const backend = fileURLToPath(new URL('../../backend', import.meta.url));
  const env = { ...process.env, DATABASE_URL: e2eDatabaseUrl() };
  execSync('npx prisma migrate deploy', { cwd: backend, env, stdio: 'inherit' });
  execSync('npx prisma db seed', { cwd: backend, env, stdio: 'inherit' });
}
