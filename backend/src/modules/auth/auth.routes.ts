import { Router } from 'express';
import { authenticate } from '../../middlewares/authenticate';
import { loginRateLimiter } from '../../middlewares/rate-limiter';
import { validate } from '../../middlewares/validate';
import { authController } from './auth.controller';
import { loginSchema } from './auth.schemas';

export const authRoutes = Router();

authRoutes.post('/login', loginRateLimiter, validate(loginSchema), authController.login);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);
authRoutes.get('/me/profile', authenticate, authController.profile);
