import type { ChipColor } from './StatusChip.types';

/** Maps domain status codes to a colored chip with a Spanish label (UI). */
export const STATUS_MAP: Record<string, { label: string; color: ChipColor }> = {
  // Vehicle
  AVAILABLE: { label: 'Disponible', color: 'success' },
  INACTIVE: { label: 'Inactivo', color: 'default' },
  IN_WORKSHOP: { label: 'En taller', color: 'warning' },
  ON_TRIP: { label: 'En viaje', color: 'info' },
  // Trip
  PENDING_ASSIGNMENT: { label: 'Pendiente de asignación', color: 'warning' },
  IN_PROGRESS: { label: 'En viaje', color: 'info' },
  COMPLETED: { label: 'Finalizado', color: 'success' },
  CANCELLED: { label: 'Cancelado', color: 'default' },
  // Maintenance
  PENDING: { label: 'Pendiente', color: 'warning' },
  // Alerts
  RESOLVED: { label: 'Resuelta', color: 'success' },
  // User / driver active flag
  ACTIVE: { label: 'Activo', color: 'success' },
  // Roles
  // Roles are badges, not actions: accent instead of the (interactive) primary.
  ADMIN: { label: 'Administrador', color: 'accent' },
  OPERATOR: { label: 'Operador', color: 'info' },
  DRIVER: { label: 'Chofer', color: 'default' },
};
