import { Chip } from '@mui/material';
import { STATUS_MAP } from './StatusChip.data';
import type { StatusChipProps } from './StatusChip.types';

export function StatusChip({ status }: StatusChipProps) {
  const entry = STATUS_MAP[status] ?? { label: status, color: 'default' as const };
  return <Chip label={entry.label} color={entry.color} size="small" />;
}
