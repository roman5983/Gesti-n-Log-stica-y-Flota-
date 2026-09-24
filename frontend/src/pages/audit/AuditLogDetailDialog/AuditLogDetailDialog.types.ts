import type { AuditLog } from '@/api/audit-logs.api';
export type ChangeKind = 'changed' | 'added' | 'removed' | 'unchanged';

export interface FieldChange {
  key: string;
  kind: ChangeKind;
  before: unknown;
  after: unknown;
}

export interface AuditLogDetailDialogProps {
  log: AuditLog | null;
  onClose: () => void;
}
