import type { Trip } from '@/api/trips.api';

export interface FinishTripDialogProps {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSaved: () => void;
}
