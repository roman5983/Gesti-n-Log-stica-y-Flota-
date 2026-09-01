import { Chip } from '@mui/material';

type ChipColor = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary';

/** Maps domain status codes to a colored chip with a Spanish label (UI). */
const STATUS_MAP: Record<string, { label: string; color: ChipColor }> = {
  // Vehicle
  AVAILABLE: { label: 'Disponible', color: 'success' },
  INACTIVE: { label: 'Inactivo', color: 'default' },
  IN_WORKSHOP: { label: 'En taller', color: 'warning' },
  ON_TRIP: { label: 'En viaje', color: 'info' },
  // Trip
  PENDING_ASSIGNMENT: { label: 'Pendiente de asignación', color: 'warning' },
  IN_PROGRESS: { label: 'En viaje', color: 'info' },
  COMPLETED: { label: 'Finalizado', color: 'success' },
  // Maintenance
  PENDING: { label: 'Pendiente', color: 'warning' },
  // Alerts
  RESOLVED: { label: 'Resuelta', color: 'success' },
  // User / driver active flag
  ACTIVE: { label: 'Activo', color: 'success' },
  // Roles
  ADMIN: { label: 'Administrador', color: 'primary' },
  OPERATOR: { label: 'Operador', color: 'info' },
  DRIVER: { label: 'Chofer', color: 'default' },
};

export function StatusChip({ status }: { status: string }) {
  const entry = STATUS_MAP[status] ?? { label: status, color: 'default' as const };
  return <Chip label={entry.label} color={entry.color} size="small" />;
}
