import type { Trip } from '@/api/trips.api';

export interface AssignTripDialogProps {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  onSaved: () => void;
}
