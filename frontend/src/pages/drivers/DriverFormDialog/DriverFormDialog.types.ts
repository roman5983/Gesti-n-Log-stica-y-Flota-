import type { Driver } from '@/api/drivers.api';

export interface DriverFormDialogProps {
  open: boolean;
  driver: Driver | null;
  onClose: () => void;
  onSaved: () => void;
}
