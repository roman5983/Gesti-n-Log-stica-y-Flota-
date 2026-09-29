import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** backend/.env, read without extra dependencies (KEY=value, optional quotes). */
function readBackendEnv(): Record<string, string> {
  const path = fileURLToPath(new URL('../../backend/.env', import.meta.url));
  const vars: Record<string, string> = {};
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return vars;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) vars[m[1]!] = m[2]!.replace(/^(['"])(.*)\1$/, '$2');
  }
  return vars;
}

/**
 * The E2E run uses the same throwaway database as the backend integration
 * tests (TEST_DATABASE_URL, name ending in `_test`) and re-seeds it with the
 * demo data before every run. Never the development database.
 */
export function e2eDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'] ?? readBackendEnv()['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL en backend/.env (ver backend/.env.example). ' +
        'Los tests E2E usan esa base aparte y la vuelven a sembrar en cada corrida.',
    );
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`TEST_DATABASE_URL apunta a "${dbName}": tiene que terminar en "_test", porque se resiembra en cada corrida.`);
  }
  return url;
}

/** Ports of the stack the E2E run starts, apart from the usual 3000/5173. */
export const E2E_API_PORT = 3100;
export const E2E_WEB_PORT = 5180;

/** Demo accounts created by the seed (README, "Credenciales del seed"). */
export const ACCOUNTS = {
  admin: { email: 'admin@empresa.com', password: 'Admin1234!' },
  operator: { email: 'operador@empresa.com', password: 'Operator1234!' },
  driver: { email: 'chofer@empresa.com', password: 'Driver1234!', name: 'Juan Pérez' },
} as const;
