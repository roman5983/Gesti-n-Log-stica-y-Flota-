import type { VehicleStatus } from '@/api/vehicles.api';

export const STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'INACTIVE', label: 'Inactivo' },
  { value: 'IN_WORKSHOP', label: 'En taller' },
  { value: 'ON_TRIP', label: 'En viaje' },
];
