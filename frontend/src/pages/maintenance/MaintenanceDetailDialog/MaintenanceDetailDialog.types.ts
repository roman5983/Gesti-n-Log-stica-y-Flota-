import type { Maintenance } from '@/api/maintenances.api';

export interface MaintenanceDetailDialogProps {
  maintenance: Maintenance | null;
  onClose: () => void;
  onChanged: () => void;
}
