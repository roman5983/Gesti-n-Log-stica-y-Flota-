import type { SortOption } from '@/components/SortControl/SortControl.types';
import type { AlertSortField } from '@/api/alerts.api';

export const SORT_OPTIONS: SortOption<AlertSortField>[] = [
  { value: 'raisedAt', label: 'Fecha', ascLabel: 'Más antiguas primero', descLabel: 'Más recientes primero' },
  { value: 'alertType', label: 'Tipo de alerta', ascLabel: 'A → Z', descLabel: 'Z → A' },
];
