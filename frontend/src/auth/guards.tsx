import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import type { Role } from '../api/types';

/** Blocks access to a route until the user is authenticated. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

/**
 * Restricts a route to specific roles. Assumes RequireAuth ran first.
 * A wrong-role user is sent to their own home instead of seeing a 403 page.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) {
    return <Navigate to={homePathForRole(user.role)} replace />;
  }
  return <>{children}</>;
}

/** Landing route per role (the driver has a mobile-style app). */
export function homePathForRole(role: Role): string {
  switch (role) {
    case 'ADMIN':
    case 'OPERATOR':
      return '/dashboard';
    case 'DRIVER':
      return '/mi-viaje';
  }
}
