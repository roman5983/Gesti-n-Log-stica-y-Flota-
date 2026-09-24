import type { Driver } from '@/api/drivers.api';

export interface DriverCredentialsDialogProps {
  open: boolean;
  driver: Driver | null;
  onClose: () => void;
}
