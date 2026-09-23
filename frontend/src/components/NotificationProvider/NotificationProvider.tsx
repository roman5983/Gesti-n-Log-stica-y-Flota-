import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { NotifierContext, type Notifier, type NotifySeverity } from '@/hooks/useNotify';
import type { Notice } from './NotificationProvider.types';
import { DURATION_MS } from './NotificationProvider.data';

/**
 * Shows one notice at a time at the bottom of the screen. A new notice
 * replaces the current one (the latest result is the relevant one), so they
 * never pile up. Rendered as an MUI Alert: icon + color + text, and
 * role="alert" so screen readers announce it.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback((severity: NotifySeverity, message: string) => {
    setNotice({ id: Date.now(), severity, message });
    setOpen(true);
  }, []);

  const notifier = useMemo<Notifier>(
    () => ({
      success: (m) => show('success', m),
      error: (m) => show('error', m),
      warning: (m) => show('warning', m),
      info: (m) => show('info', m),
    }),
    [show],
  );

  return (
    <NotifierContext.Provider value={notifier}>
      {children}
      <Snackbar
        key={notice?.id}
        open={open}
        autoHideDuration={notice ? DURATION_MS[notice.severity] : null}
        onClose={(_e, reason) => {
          if (reason !== 'clickaway') setOpen(false);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {notice ? (
          <Alert
            severity={notice.severity}
            variant="filled"
            onClose={() => setOpen(false)}
            sx={{ minWidth: 320, maxWidth: 560, boxShadow: 6 }}
          >
            {notice.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </NotifierContext.Provider>
  );
}
