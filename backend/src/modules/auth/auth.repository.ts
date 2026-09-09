import type { RefreshToken } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma-client';

/** Refresh token persistence (P-C): enables session revocation. */
export const authRepository = {
  createRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  /**
   * Look up a refresh token by hash REGARDLESS of revoked/expiry state.
   * The caller (auth.service) inspects those fields: a hash that exists but
   * is already revoked means the token is being replayed (rotation reuse) —
   * a theft signal — which must be told apart from a hash that never existed.
   */
  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({ where: { tokenHash } });
  },

  async revoke(id: number): Promise<void> {
    await prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
  },

  async revokeAllForUser(userId: number): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  },
};
