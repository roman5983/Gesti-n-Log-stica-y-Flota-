import type { SortOption } from '@/components/SortControl/SortControl.types';
import type { MaintenanceSortField } from '@/api/maintenances.api';

export const SORT_OPTIONS: SortOption<MaintenanceSortField>[] = [
  { value: 'scheduledAt', label: 'Fecha programada', ascLabel: 'Más antiguos primero', descLabel: 'Más recientes primero' },
  { value: 'completedAt', label: 'Fecha de finalización', ascLabel: 'Más antiguos primero', descLabel: 'Más recientes primero' },
  { value: 'type', label: 'Tipo de mantenimiento', ascLabel: 'A → Z', descLabel: 'Z → A' },
  { value: 'vehicle', label: 'Vehículo (patente)', ascLabel: 'A → Z', descLabel: 'Z → A' },
  { value: 'km', label: 'Kilometraje', ascLabel: 'Menor primero', descLabel: 'Mayor primero' },
];
