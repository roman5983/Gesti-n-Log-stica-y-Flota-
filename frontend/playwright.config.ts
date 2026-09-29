import { defineConfig, devices } from '@playwright/test';
import { E2E_API_PORT, E2E_WEB_PORT, e2eDatabaseUrl } from './e2e/test-env';

/**
 * End-to-end tests: a real browser against the whole system — the React app
 * (Vite dev server), the Express API and MySQL. Run with `npm run test:e2e`.
 *
 * Playwright starts its own backend (port 3100) and frontend (5180) against
 * the TEST database, so it neither collides with an app already running on
 * 3000/5173 nor touches the development data. `e2e/global-setup.ts`
 * migrates and re-seeds that database before every run.
 *
 * Tests run one at a time: they share the database and some depend on the
 * state left by the previous step (create → assign → finish a trip).
 */
const databaseUrl = e2eDatabaseUrl();

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    // A locator that finds nothing fails in 15 s with its call log, instead
    // of silently using up the whole minute of the test.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      url: `http://localhost:${E2E_API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        PORT: String(E2E_API_PORT),
        DATABASE_URL: databaseUrl,
        CORS_ORIGIN: `http://localhost:${E2E_WEB_PORT}`,
        APP_URL: `http://localhost:${E2E_WEB_PORT}`,
        // No background alert passes during the run: the tests evaluate on demand.
        ALERTS_EVAL_TIME: 'off',
        ALERTS_EVAL_INTERVAL_MIN: '0',
      },
    },
    {
      command: `npx vite --port ${E2E_WEB_PORT} --strictPort`,
      url: `http://localhost:${E2E_WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        API_PROXY_TARGET: `http://localhost:${E2E_API_PORT}`,
        // Without a Maps key the destination is free text: no Google dropdown to click.
        VITE_GOOGLE_MAPS_API_KEY: '',
      },
    },
  ],
});
