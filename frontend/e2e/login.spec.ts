import { expect, test } from '@playwright/test';
import { ACCOUNTS } from './test-env';
import { login, passwordField } from './helpers';

test.describe('login and home screen by role', () => {
  test('a wrong password shows the app message and stays on the login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Usuario (email)').fill(ACCOUNTS.admin.email);
    await passwordField(page).fill('no-es-la-clave1');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await expect(page.getByRole('alert')).toContainText('Credenciales inválidas');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the administrator lands on the dashboard and sees the admin sections', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Usuarios', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Auditoría', exact: true })).toBeVisible();
  });

  test('the operator lands on the dashboard without the admin sections', async ({ page }) => {
    await login(page, ACCOUNTS.operator);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('link', { name: 'Viajes', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Usuarios', exact: true })).toHaveCount(0);

    // Typing an admin URL by hand does not get around the guard.
    await page.goto('/usuarios');
    await expect(page).not.toHaveURL(/\/usuarios/);
  });

  test('the driver lands on "Mi viaje"', async ({ page }) => {
    await login(page, ACCOUNTS.driver);
    await expect(page).toHaveURL(/\/mi-viaje/);
  });
});
