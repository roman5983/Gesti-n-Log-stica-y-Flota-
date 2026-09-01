import type { RefreshToken } from '../../generated/prisma/client';
import { prisma } from '../../database/prisma-client';

/** Refresh token persistence (P-C): enables session revocation. */
export const authRepository = {
  createRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  },

  findValidByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({
      where: { tokenHash, revoked: false, expiresAt: { gt: new Date() } },
    });
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
