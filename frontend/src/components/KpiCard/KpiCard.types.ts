import type { ReactNode } from 'react';
import type { Tone } from '@/theme/theme.types';

export interface KpiCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  tone?: Tone;
  /** When set, the whole card becomes a shortcut to this route. */
  to?: string;
}
