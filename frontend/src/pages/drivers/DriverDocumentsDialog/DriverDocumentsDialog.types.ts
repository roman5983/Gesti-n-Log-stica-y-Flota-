import type { Driver } from '@/api/drivers.api';

export interface DriverDocumentsDialogProps {
  driver: Driver | null;
  canManage: boolean;
  onClose: () => void;
}
