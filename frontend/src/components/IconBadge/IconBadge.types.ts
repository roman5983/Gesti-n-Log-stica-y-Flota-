import type { ReactNode } from 'react';
import type { Tone } from '@/theme/theme.types';

export interface IconBadgeProps {
  children: ReactNode;
  tone: Tone;
  /** Diameter in px. */
  size?: number;
  /** Grey, untinted version (e.g. a resolved alert). */
  muted?: boolean;
}
