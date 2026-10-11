import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';
import { clientIp } from '../shared/utils/client-ip';

const WINDOW_MS = 15 * 60 * 1000;
const message = {
  error: { code: 'TOO_MANY_REQUESTS', message: 'Demasiados intentos de inicio de sesión, probá de nuevo más tarde' },
};

/**
 * Rate limiting on sensitive endpoints (RNF).
 * Login is the main brute-force target: 10 attempts / 15 min per user IP.
 *
 * Two limiters in a row:
 * - per user IP (clientIp: CLIENT_IP_HEADER if configured, else req.ip): the
 *   real 10-attempt limit;
 * - per req.ip, 100 attempts: only matters when CLIENT_IP_HEADER is set.
 *   That header can be forged by calling the backend directly instead of
 *   through Vercel, with a new value per attempt; this cap still stops it.
 *   Through Vercel, req.ip is Vercel's address, shared by every user, so the
 *   cap is wide enough not to block normal use.
 */
export const loginRateLimiters: RequestHandler[] = [
  rateLimit({
    windowMs: WINDOW_MS,
    limit: 10,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => clientIp(req, env.CLIENT_IP_HEADER),
    message,
  }),
  ...(env.CLIENT_IP_HEADER
    ? [
        rateLimit({
          windowMs: WINDOW_MS,
          limit: 100,
          standardHeaders: false,
          legacyHeaders: false,
          message,
        }),
      ]
    : []),
];
