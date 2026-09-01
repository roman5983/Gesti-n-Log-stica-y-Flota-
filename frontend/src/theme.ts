import { createTheme } from '@mui/material/styles';

/** App theme. Dark sidebar layouts (DOC-5) are handled per-layout; this sets
 *  the global palette, typography and component defaults. */
export const theme = createTheme({
  palette: {
    primary: { main: '#1e88e5' },
    secondary: { main: '#5e35b1' },
    background: { default: '#f4f6f8' },
    success: { main: '#2e7d32' },
    warning: { main: '#ed6c02' },
    error: { main: '#d32f2f' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
  },
});
