import type { NotifySeverity } from '@/hooks/useNotify';

/** How long each kind of notice stays up. Errors need time to be read. */
export const DURATION_MS: Record<NotifySeverity, number> = {
  success: 4000,
  info: 5000,
  warning: 7000,
  error: 8000,
};
