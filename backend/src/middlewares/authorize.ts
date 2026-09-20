import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../generated/prisma/client';
import { ForbiddenError, UnauthorizedError } from '../shared/errors/app-error';

/**
 * Role-based authorization (RNF). Must run AFTER authenticate.
 * Usage: router.get('/', authenticate, authorize('ADMIN', 'OPERATOR'), handler)
 */
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Se requiere autenticación'));
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('No tenés permisos para realizar esta operación'));
      return;
    }
    next();
  };
}
