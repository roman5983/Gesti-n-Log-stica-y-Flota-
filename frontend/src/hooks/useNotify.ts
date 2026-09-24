import { createContext, useContext } from 'react';

export type NotifySeverity = 'success' | 'error' | 'warning' | 'info';

export interface Notifier {
  /** Action done: short confirmation that disappears on its own. */
  success: (message: string) => void;
  /** Action rejected or failed: stays longer and can be closed by hand. */
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

export const NotifierContext = createContext<Notifier | null>(null);

/**
 * Pop-up notices ("carteles") for the result of an action, visible wherever
 * the user is scrolled. Requires <NotificationProvider> (mounted in main.tsx).
 */
export function useNotify(): Notifier {
  const notifier = useContext(NotifierContext);
  if (!notifier) throw new Error('useNotify must be used inside <NotificationProvider>');
  return notifier;
}
