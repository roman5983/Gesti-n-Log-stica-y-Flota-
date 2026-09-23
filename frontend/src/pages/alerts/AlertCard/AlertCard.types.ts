import type { SvgIconComponent } from '@mui/icons-material';
import type { Tone } from '@/theme/theme.types';
import type { ReactNode } from 'react';
import type { Alert } from '@/api/alerts.api';

export type AlertCategory = 'license' | 'document' | 'insurance' | 'maintenance' | 'vehicle' | 'other';

export interface AlertPresentation {
  label: string;
  category: AlertCategory;
  icon: SvgIconComponent;
  tone: Tone;
  /** Short urgency tag shown next to the title. */
  tag?: string;
}

export interface AlertCardProps {
  alert: Alert;
  /** Buttons on the right (go to source, resolve). */
  actions?: ReactNode;
}
