import type { Alert } from '@/api/alerts.api';

/**
 * Where each alert's entity is managed, so "ir al origen" can jump there.
 * DRIVER alerts open the chofer's form; DRIVER_DOCUMENT alerts open their
 * documentation dialog instead (`open=docs` tells DriversPage which one).
 */
export function sourceLink(a: Alert): string | null {
  switch (a.entityType) {
    case 'VEHICLE':
      return `/vehiculos?highlight=${a.entityId}`;
    case 'DRIVER':
      return `/choferes?highlight=${a.entityId}`;
    case 'DRIVER_DOCUMENT':
      return a.linkedDriverId ? `/choferes?highlight=${a.linkedDriverId}&open=docs` : null;
    default:
      return null;
  }
}
