import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './test-env';
import { dateTimeDigits, login, typeDate } from './helpers';

/**
 * The core use case end to end, across two roles: the operator creates a
 * trip and assigns it; the driver sees it in "Mi viaje" and closes it with
 * the final odometer reading. Each step depends on the previous one.
 */
test.describe.configure({ mode: 'serial' });

const destination = `Rosario E2E ${Date.now()}`;

test('the operator creates a trip and assigns it to a driver', async ({ page }) => {
  await login(page, ACCOUNTS.operator);
  await page.getByRole('link', { name: 'Viajes', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Viajes' })).toBeVisible();

  // Create
  await page.getByRole('button', { name: 'Crear viaje' }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo viaje' });
  await form.getByLabel('Destino').fill(destination);
  await typeDate(page, 'Fecha y hora de salida', dateTimeDigits(2));
  await form.getByRole('button', { name: 'Crear' }).click();
  await expect(form).toBeHidden();

  // Find it with the search box and check its state
  await page.getByPlaceholder('Chofer o destino').fill(destination);
  const row = page.getByRole('row', { name: new RegExp(destination) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Pendiente de asignación');

  // Assign: the driver is chosen, the vehicle is picked by the system
  await row.getByRole('button', { name: 'Asignar' }).click();
  const dialog = page.getByRole('dialog', { name: 'Asignar viaje' });
  await dialog.getByRole('combobox', { name: 'Chofer' }).click();
  await page.getByRole('option', { name: new RegExp(ACCOUNTS.driver.name) }).click();
  await dialog.getByRole('button', { name: 'Asignar' }).click();
  await expect(dialog).toBeHidden();
  await expect(row).toContainText('En viaje');
});

test('the driver sees the trip in "Mi viaje" and closes it', async ({ page }) => {
  await login(page, ACCOUNTS.driver);
  await expect(page).toHaveURL(/\/mi-viaje/);
  await expect(page.getByText(destination)).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar hoja de ruta' }).click();
  const dialog = page.getByRole('dialog', { name: 'Finalizar viaje' });

  // The helper text shows the departure reading: "Debe ser mayor al inicial (52.000 km)"
  const helper = await dialog.getByText(/Debe ser mayor al inicial/).textContent();
  const departureKm = Number((helper ?? '').replace(/\D/g, ''));
  expect(departureKm).toBeGreaterThan(0);

  await dialog.getByLabel('Kilometraje final').fill(String(departureKm + 150));
  await dialog.getByRole('button', { name: 'Finalizar viaje' }).click();
  await expect(page.getByText('No tenés un viaje asignado en este momento.')).toBeVisible();
});

test('the operator sees the trip finished', async ({ page }) => {
  await login(page, ACCOUNTS.operator);
  await page.goto('/viajes');
  await page.getByPlaceholder('Chofer o destino').fill(destination);
  await expect(page.getByRole('row', { name: new RegExp(destination) })).toContainText('Finalizado');
});
