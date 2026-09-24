import type { TripStatus } from '@/api/trips.api';

export const STATUS_OPTIONS: { value: TripStatus; label: string }[] = [
  { value: 'PENDING_ASSIGNMENT', label: 'Pendiente de asignación' },
  { value: 'IN_PROGRESS', label: 'En viaje' },
  { value: 'COMPLETED', label: 'Finalizado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];
