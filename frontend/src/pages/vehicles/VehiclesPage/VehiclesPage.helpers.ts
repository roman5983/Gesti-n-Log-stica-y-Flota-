import type { VehicleStatus } from '@/api/vehicles.api';
import { STATUS_OPTIONS } from './VehiclesPage.data';

/** Reads an optional `?estado=` param so dashboard shortcuts can preset the filter. */
export function statusFromParams(value: string | null): VehicleStatus | '' {
  return STATUS_OPTIONS.some((o) => o.value === value) ? (value as VehicleStatus) : '';
}
