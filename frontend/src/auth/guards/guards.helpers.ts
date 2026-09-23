import type { Role } from '@/api/types';

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
