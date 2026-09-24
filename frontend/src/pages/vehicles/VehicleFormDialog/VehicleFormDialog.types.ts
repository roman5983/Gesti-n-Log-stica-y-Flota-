import type { Vehicle } from '@/api/vehicles.api';

export interface VehicleFormDialogProps {
  open: boolean;
  vehicle: Vehicle | null;
  onClose: () => void;
  onSaved: () => void;
}
