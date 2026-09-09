import type { NextFunction, Request, Response } from 'express';
import { isProduction } from '../../config/env';
import { authService } from './auth.service';
import type { LoginDto } from './auth.schemas';

const REFRESH_COOKIE = 'refresh_token';

/**
 * Refresh token travels in an httpOnly cookie (Stage 1 decision):
 * inaccessible to JS → minimizes XSS exposure. Scoped to the refresh path.
 */
function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/v1/auth',
    expires: expiresAt,
  });
}

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const session = await authService.login(req.body as LoginDto);
      setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
      res.status(200).json({ data: { user: session.user, accessToken: session.accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      const session = await authService.refresh(token ?? '');
      setRefreshCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
      res.status(200).json({ data: { user: session.user, accessToken: session.accessToken } });
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
      res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // authenticate middleware guarantees req.user
      const user = await authService.getCurrentUser(req.user!.id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  },

  async profile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await authService.getProfile(req.user!.id);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  },
};
