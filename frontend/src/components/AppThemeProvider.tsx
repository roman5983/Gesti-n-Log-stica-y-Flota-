import { useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { buildTheme } from '../theme';
import { useColorMode } from '../hooks/use-color-mode';

/**
 * Wires the color mode store to MUI: rebuilds the theme whenever the effective
 * mode changes and hands it to the whole tree. `useMemo` keeps the theme object
 * stable between renders, so switching pages does not re-create it (which would
 * invalidate every styled component downstream).
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { mode } = useColorMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
