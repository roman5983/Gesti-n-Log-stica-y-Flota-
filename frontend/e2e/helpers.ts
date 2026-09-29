import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The password input. Not getByLabel('Contraseña'): the field is required, so
 * its label reads "Contraseña *" (exact match fails), and the eye button's
 * "Mostrar u ocultar contraseña" also contains the word (substring match
 * finds two). "Starts with" picks exactly the input.
 */
export const passwordField = (page: Page): Locator => page.getByLabel(/^Contraseña/);

/** Logs in through the real form and waits for the role's home screen. */
export async function login(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario (email)').fill(account.email);
  await passwordField(page).fill(account.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** Digits to type into a dd/mm/aaaa hh:mm field, `days` days from now at 14:30. */
export function dateTimeDigits(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(d.getDate())}${two(d.getMonth() + 1)}${d.getFullYear()}1430`;
}

/**
 * Fills one of the app's date fields (MUI sections: dd, mm, aaaa, hh, mm).
 * Focusing selects the first section; each complete section jumps to the
 * next, so typing the digits in order is how a user fills it.
 */
export async function typeDate(page: Page, label: string, digits: string): Promise<void> {
  const field = page.getByRole('textbox', { name: label });
  await field.focus();
  await page.keyboard.type(digits, { delay: 40 });
}
