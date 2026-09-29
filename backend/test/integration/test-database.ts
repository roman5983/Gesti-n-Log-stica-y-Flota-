import 'dotenv/config';

/**
 * The integration tests' database: TEST_DATABASE_URL (from the environment
 * or `backend/.env`). Refuses anything whose database name doesn't end in
 * `_test`, because the tests wipe every table: a typo must not be able to
 * erase the development data.
 */
export function testDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'];
  if (!url) {
    throw new Error(
      'Falta TEST_DATABASE_URL. Agregala a backend/.env, por ejemplo:\n' +
        'TEST_DATABASE_URL="mysql://root:password@localhost:3306/logistics_management_test?allowPublicKeyRetrieval=true"',
    );
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `TEST_DATABASE_URL apunta a la base "${dbName}". Por seguridad tiene que terminar en "_test": ` +
        'los tests de integración borran todas sus tablas.',
    );
  }
  return url;
}
