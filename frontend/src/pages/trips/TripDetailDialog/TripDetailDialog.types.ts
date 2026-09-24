import type { Trip } from '@/api/trips.api';
export interface TripDetailDialogProps {
  trip: Trip | null;
  onClose: () => void;
}
