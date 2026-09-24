import type { TripStatus } from '@/api/trips.api';
import { STATUS_OPTIONS } from './TripsPage.data';

/** Reads an optional `?estado=` param so dashboard shortcuts can preset the filter. */
export function statusFromParams(value: string | null): TripStatus | '' {
  return STATUS_OPTIONS.some((o) => o.value === value) ? (value as TripStatus) : '';
}
