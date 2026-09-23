import type { Trip } from '@/api/trips.api';

export interface TripFormDialogProps {
  open: boolean;
  /** null → create; a trip → edit (only allowed while PENDING_ASSIGNMENT, A-4). */
  trip?: Trip | null;
  onClose: () => void;
  onSaved: () => void;
}
