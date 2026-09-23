import type { NotifySeverity } from '@/hooks/useNotify';

export interface Notice {
  id: number;
  severity: NotifySeverity;
  message: string;
}
