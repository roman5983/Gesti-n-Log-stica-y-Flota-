import rateLimit from 'express-rate-limit';

/**
 * Rate limiting on sensitive endpoints (RNF).
 * Login is the main brute-force target: 10 attempts / 15 min per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, try again later' },
  },
});
