import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';

/**
 * Login and logout leave a trace in the audit log (who and when). Failed
 * logins and repeated logouts do not.
 */

const m = vi.hoisted(() => ({
  usersRepository: { findByEmail: vi.fn(), findById: vi.fn() },
  authRepository: { createRefreshToken: vi.fn(), findByHash: vi.fn(), revoke: vi.fn(), revokeAllForUser: vi.fn() },
  record: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: {
    JWT_ACCESS_SECRET: 'a'.repeat(64),
    ACCESS_TOKEN_TTL: '15m',
    REFRESH_TOKEN_TTL_DAYS: 7,
    PASSWORD_ENCRYPTION_KEY: '0'.repeat(64),
  },
}));
vi.mock('../../database/prisma-client', () => ({ prisma: {} }));
vi.mock('../users/users.repository', () => ({ usersRepository: m.usersRepository }));
vi.mock('../drivers/drivers.repository', () => ({ driversRepository: { findById: vi.fn() } }));
vi.mock('./auth.repository', () => ({ authRepository: m.authRepository }));
vi.mock('../audit-logs/audit-logs.service', () => ({ auditLogsService: { record: m.record } }));

import { authService } from './auth.service';

const PASSWORD = 'Admin1234!';
const HASH = bcrypt.hashSync(PASSWORD, 4);
const ana = {
  id: 1,
  name: 'Ana',
  email: 'admin@empresa.com',
  role: 'ADMIN',
  isActive: true,
  passwordHash: HASH,
};

beforeEach(() => vi.clearAllMocks());

describe('authService — session audit', () => {
  it('records LOGIN on a successful login, with the user as actor', async () => {
    m.usersRepository.findByEmail.mockResolvedValue(ana);

    await authService.login({ email: ana.email, password: PASSWORD });

    expect(m.record).toHaveBeenCalledWith({ actorId: 1, action: 'LOGIN', entity: 'USER', entityId: 1 });
  });

  it('records nothing when the password is wrong', async () => {
    m.usersRepository.findByEmail.mockResolvedValue(ana);

    await expect(authService.login({ email: ana.email, password: 'otra' })).rejects.toThrow('Credenciales inválidas');
    expect(m.record).not.toHaveBeenCalled();
  });

  it('records LOGOUT when a live session is closed', async () => {
    m.authRepository.findByHash.mockResolvedValue({ id: 9, userId: 1, revoked: false });

    await authService.logout('token');

    expect(m.authRepository.revoke).toHaveBeenCalledWith(9);
    expect(m.record).toHaveBeenCalledWith({ actorId: 1, action: 'LOGOUT', entity: 'USER', entityId: 1 });
  });

  it('records nothing for a repeated logout (token already revoked or unknown)', async () => {
    m.authRepository.findByHash.mockResolvedValueOnce({ id: 9, userId: 1, revoked: true });
    await authService.logout('token');
    m.authRepository.findByHash.mockResolvedValueOnce(null);
    await authService.logout('otro');
    await authService.logout(undefined);

    expect(m.record).not.toHaveBeenCalled();
  });
});
