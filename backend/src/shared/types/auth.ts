import type { Role } from '../../generated/prisma/client';

/** Payload embedded in every access token. Kept minimal on purpose. */
export interface JwtPayload {
  /** User id (subject). */
  sub: number;
  role: Role;
}

/** Authenticated user attached to the request by the authenticate middleware. */
export interface AuthenticatedUser {
  id: number;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
