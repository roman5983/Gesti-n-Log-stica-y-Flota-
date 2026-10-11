/**
 * Replaces the passwords of every demo account (the seed's staff and
 * drivers) with new random ones, and prints them.
 *
 * Why: the seed's passwords are in the README of a public repository. On the
 * deployed demo anyone could log in as administrator with them. Run this
 * right after seeding a public deployment and hand the printed credentials
 * over privately. Re-running the seed restores the README passwords, so run
 * this again after it.
 *
 * Usage (from backend/, against the target database):
 *   DATABASE_URL='...' PASSWORD_ENCRYPTION_KEY='...' npx tsx prisma/rotate-demo-passwords.ts --yes
 *
 * PASSWORD_ENCRYPTION_KEY must be the deployed backend's: driver passwords
 * are also stored encrypted with it (the administrator can look them up).
 * Open sessions of those accounts are closed (refresh tokens revoked).
 */
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/database/prisma-client';
import { encrypt } from '../src/shared/utils/crypto';
import { DRIVERS, STAFF } from './seed-history';

const BCRYPT_ROUNDS = 10;
// No look-alike characters (0/O, 1/l/I), so the passwords can be dictated or copied by hand.
const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';

/** Three groups like "Kp7m": 12 random characters, always with letters and digits. */
export function randomPassword(): string {
  const pick = (chars: string) => chars[randomInt(chars.length)]!;
  const group = () => pick(LETTERS) + pick(LETTERS) + pick(DIGITS) + pick(LETTERS);
  return [group(), group(), group()].join('-');
}

async function main(): Promise<void> {
  if (!process.argv.includes('--yes')) {
    console.error('Cambia las contraseñas de TODAS las cuentas de demostración. Para confirmar, agregá --yes.');
    process.exitCode = 1;
    return;
  }

  const accounts = [
    ...STAFF.map((s) => ({ email: s.email, name: s.name, role: s.role as string, driver: false })),
    ...DRIVERS.map((d) => ({ email: d.email, name: d.name, role: 'DRIVER', driver: true })),
  ];

  const rows: { role: string; name: string; email: string; password: string }[] = [];
  for (const a of accounts) {
    const user = await prisma.user.findUnique({ where: { email: a.email }, select: { id: true } });
    if (!user) continue; // account not in this database (seed not run, or deleted)

    const password = randomPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      ...(a.driver
        ? [prisma.driver.update({ where: { userId: user.id }, data: { encryptedPassword: encrypt(password) } })]
        : []),
      prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } }),
    ]);
    rows.push({ role: a.role, name: a.name, email: a.email, password });
  }

  console.log(`\nContraseñas nuevas (${rows.length} cuentas). Guardalas: no se vuelven a mostrar.\n`);
  for (const r of rows) {
    console.log(`${r.role.padEnd(9)} ${r.email.padEnd(24)} ${r.password}   (${r.name})`);
  }
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
