import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import type { LicenseCategory, Role, User } from '../../generated/prisma/client';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors/app-error';
import { sha256 } from '../../shared/utils/crypto';
import type { JwtPayload } from '../../shared/types/auth';
import { usersRepository } from '../users/users.repository';
import { driversRepository } from '../drivers/drivers.repository';
import { authRepository } from './auth.repository';
import type { LoginDto } from './auth.schemas';

export interface AuthenticatedSession {
  user: PublicUser;
  accessToken: string;
  /** Opaque random token; only its SHA-256 is persisted. */
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

/** Read-only "Mis datos" view: account fields + driver profile if any. */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  driver: {
    dni: string;
    licenseCategory: LicenseCategory;
    licenseExpiryDate: Date;
    completedTrips: number;
    avgKm: number;
  } | null;
}

/** Strips credentials — the API never returns hashes or internal fields. */
function toPublicUser(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function signAccessToken(user: User): string {
  const payload: JwtPayload = { sub: user.id, role: user.role };
  const options: SignOptions = { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

async function issueSession(user: User): Promise<AuthenticatedSession> {
  // Refresh token is opaque (not a JWT): random 256-bit value, stored hashed.
  // If the DB leaks, the tokens are still unusable.
  const refreshToken = randomBytes(32).toString('hex');
  const refreshTokenExpiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await authRepository.createRefreshToken(user.id, sha256(refreshToken), refreshTokenExpiresAt);

  return {
    user: toPublicUser(user),
    accessToken: signAccessToken(user),
    refreshToken,
    refreshTokenExpiresAt,
  };
}

export const authService = {
  async login(dto: LoginDto): Promise<AuthenticatedSession> {
    const user = await usersRepository.findByEmail(dto.email);

    // Same error for "not found", "inactive" and "wrong password":
    // never reveal which credential failed (account enumeration).
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }
    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid credentials');
    }

    return issueSession(user);
  },

  /**
   * Refresh token ROTATION: each refresh revokes the used token and issues a
   * new pair.
   *
   * Reuse detection: the lookup is by hash only, so we can tell three cases
   * apart. A hash that never existed is just an invalid token. A hash that
   * exists but is ALREADY REVOKED means the token is being replayed — after
   * rotation the legitimate client holds a newer token, so a revoked one
   * coming back points to a stolen copy. That is treated as theft: every
   * session of the user is revoked. An expired token is merely invalid.
   */
  async refresh(refreshToken: string): Promise<AuthenticatedSession> {
    const stored = await authRepository.findByHash(sha256(refreshToken));
    if (!stored) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (stored.revoked) {
      // Replay of a rotated/revoked token → assume the token was stolen.
      await authRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (stored.expiresAt <= new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const user = await usersRepository.findById(stored.userId);
    if (!user || !user.isActive) {
      await authRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    await authRepository.revoke(stored.id);
    return issueSession(user);
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return; // idempotent: logging out twice is not an error
    const stored = await authRepository.findByHash(sha256(refreshToken));
    if (stored && !stored.revoked) {
      await authRepository.revoke(stored.id);
    }
  },

  async getCurrentUser(userId: number): Promise<PublicUser> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User no longer valid');
    }
    return toPublicUser(user);
  },

  /** Full "Mis datos" profile of the authenticated user (all roles). */
  async getProfile(userId: number): Promise<UserProfile> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User no longer valid');
    }

    let driver: UserProfile['driver'] = null;
    if (user.role === 'DRIVER') {
      const d = await driversRepository.findById(userId);
      if (d) {
        driver = {
          dni: d.dni,
          licenseCategory: d.licenseCategory,
          licenseExpiryDate: d.licenseExpiryDate,
          completedTrips: d.completedTrips,
          avgKm: Number(d.avgKm),
        };
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      driver,
    };
  },
};
