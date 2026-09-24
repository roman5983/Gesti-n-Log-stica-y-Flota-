import type { MaintenanceType } from '@/api/maintenance-types.api';

export interface MaintenanceTypeFormDialogProps {
  open: boolean;
  type: MaintenanceType | null;
  onClose: () => void;
  onSaved: () => void;
}
