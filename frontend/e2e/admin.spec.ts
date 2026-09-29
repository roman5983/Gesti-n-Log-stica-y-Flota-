import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, E2E_WEB_PORT } from './test-env';
import { login } from './helpers';

/**
 * Administrator screens. One session for the whole file (serial, shared
 * page): the login is limited to 10 attempts per 15 minutes per IP, and
 * every E2E test comes from the same one.
 *
 * Sidebar links are matched with `exact: true`: the dashboard cards are links
 * too ("Vehículos disponibles", "Usuarios del sistema") and contain the same words.
 */
test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  // A page made here doesn't get the config's `use` options: pass them.
  page = await browser.newPage({
    baseURL: `http://localhost:${E2E_WEB_PORT}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
  });
  page.setDefaultTimeout(15_000);
  await login(page, ACCOUNTS.admin);
});

test.afterAll(async () => {
  await page.close();
});

test('creates a vehicle and finds it in the list', async () => {
  const plate = `E2E${String(Date.now()).slice(-4)}`;
  await page.getByRole('link', { name: 'Vehículos', exact: true }).click();
  await page.getByRole('button', { name: 'Nuevo vehículo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Patente').fill(plate);
  await dialog.getByLabel('Modelo').fill('Mercedes Sprinter');
  await dialog.getByLabel('Año').fill('2024');
  await dialog.getByLabel('Kilometraje inicial').fill('1500');
  await dialog.getByRole('button', { name: 'Crear' }).click();
  await expect(dialog).toBeHidden();

  await page.getByPlaceholder('Patente o modelo').fill(plate);
  const row = page.getByRole('row', { name: new RegExp(plate) });
  await expect(row).toContainText('Disponible');
});

test('an empty form is not sent: the app says which field is missing', async () => {
  await page.getByRole('button', { name: 'Nuevo vehículo' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Crear' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Completá el campo "Patente"');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
});

test('evaluates alerts and shows them as cards', async () => {
  await page.getByRole('link', { name: 'Alertas', exact: true }).click();
  await page.getByRole('button', { name: 'Evaluar alertas' }).click();
  // The seed prepares data that triggers every alert type; one is enough here.
  await expect(page.getByRole('heading', { name: 'Licencia vencida' }).first()).toBeVisible();
});

test('the audit log shows the session start', async () => {
  await page.getByRole('link', { name: 'Auditoría', exact: true }).click();
  await expect(page.getByText('Inicio de sesión').first()).toBeVisible();
});

test('the company time zone, language and date format cannot be edited', async () => {
  await page.getByRole('link', { name: 'Configuración', exact: true }).click();
  await expect(page.getByLabel('Zona horaria')).toBeDisabled();
  await expect(page.getByLabel('Idioma')).toBeDisabled();
  await expect(page.getByLabel('Formato de fecha')).toBeDisabled();
});
