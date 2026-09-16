import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';

/**
 * App theme — "verde petróleo" (dark teal) palette, available in light and
 * dark mode.
 *
 * The theme is built by a factory instead of being a module-level constant:
 * the color mode lives in a store (see stores/color-mode-store) and
 * AppThemeProvider rebuilds the theme whenever the mode changes.
 *
 * Design notes:
 *  - The primary color flips between a deep teal (light mode) and a lighter
 *    teal (dark mode). A dark primary over a dark background would be
 *    unreadable, so each mode gets its own tone rather than sharing one.
 *  - Semantic colors (success / warning / error / info) are deliberately kept
 *    away from teal so they stay distinguishable from the brand color: success
 *    is a leaf green, info a clear blue.
 *  - The dark sidebar (DOC-5 §5.1/5.2) is no longer hardcoded in the layout;
 *    it is exposed here as `palette.sidebar` so both modes stay consistent.
 */

/** Custom palette slot for the dark navigation sidebar. */
export interface SidebarPalette {
  /** Sidebar background. */
  bg: string;
  /** Brand title on top of the sidebar. */
  title: string;
  /** Idle navigation item. */
  text: string;
  /** Background of the active navigation item. */
  activeBg: string;
  /** Text/icon of the active navigation item. */
  activeText: string;
  /** Separator line inside the sidebar. */
  divider: string;
  /** Hover background for idle items. */
  hoverBg: string;
}

declare module '@mui/material/styles' {
  interface Palette {
    sidebar: SidebarPalette;
  }
  interface PaletteOptions {
    sidebar?: SidebarPalette;
  }
}

const LIGHT_SIDEBAR: SidebarPalette = {
  bg: '#0E2B29',
  title: '#FFFFFF',
  text: 'rgba(255, 255, 255, 0.75)',
  activeBg: 'rgba(77, 182, 172, 0.20)',
  activeText: '#FFFFFF',
  divider: 'rgba(255, 255, 255, 0.12)',
  hoverBg: 'rgba(255, 255, 255, 0.06)',
};

/** In dark mode the sidebar goes *darker* than the page so it still reads as a
 *  distinct surface instead of blending into the background. */
const DARK_SIDEBAR: SidebarPalette = {
  bg: '#0A1312',
  title: '#FFFFFF',
  text: 'rgba(255, 255, 255, 0.70)',
  activeBg: 'rgba(77, 182, 172, 0.22)',
  activeText: '#FFFFFF',
  divider: 'rgba(255, 255, 255, 0.10)',
  hoverBg: 'rgba(255, 255, 255, 0.05)',
};

function palette(mode: PaletteMode) {
  if (mode === 'dark') {
    return {
      mode,
      primary: { main: '#4DB6AC', light: '#82E9DE', dark: '#00867D', contrastText: '#04211F' },
      secondary: { main: '#26A69A', contrastText: '#04211F' },
      background: { default: '#0F1615', paper: '#18211F' },
      text: { primary: '#E6EDEB', secondary: 'rgba(230, 237, 235, 0.68)' },
      divider: 'rgba(255, 255, 255, 0.10)',
      success: { main: '#66BB6A', contrastText: '#0B1F0C' },
      warning: { main: '#FFA726', contrastText: '#241400' },
      error: { main: '#EF5350', contrastText: '#2A0707' },
      info: { main: '#4FC3F7', contrastText: '#04212B' },
      sidebar: DARK_SIDEBAR,
    };
  }
  return {
    mode,
    primary: { main: '#00695C', light: '#4DB6AC', dark: '#004D40', contrastText: '#FFFFFF' },
    secondary: { main: '#00897B', contrastText: '#FFFFFF' },
    background: { default: '#F2F6F5', paper: '#FFFFFF' },
    success: { main: '#2E7D32', contrastText: '#FFFFFF' },
    // Amber is too bright to carry white text: white over #ED6C02 only reaches
    // 3.1:1, under the 4.5:1 WCAG AA floor. Dark text on the same amber reads
    // cleanly and keeps the warning chips recognizable.
    warning: { main: '#ED6C02', contrastText: '#2B1400' },
    error: { main: '#D32F2F', contrastText: '#FFFFFF' },
    info: { main: '#0277BD', contrastText: '#FFFFFF' },
    sidebar: LIGHT_SIDEBAR,
  };
}

/** Builds the MUI theme for the given color mode. */
export function buildTheme(mode: PaletteMode): Theme {
  return createTheme({
    palette: palette(mode),
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: (themeParam) => ({
          // Tells the browser to render its own widgets (scrollbars, native
          // date/time pickers, form controls) in the matching scheme. Without
          // this, the native datetime-local inputs used in Viajes/Reportes
          // stay bright white in dark mode.
          ':root': { colorScheme: themeParam.palette.mode },
        }),
      },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: {
        styleOverrides: {
          // MUI tints elevated surfaces in dark mode with a white overlay,
          // which washes the teal background out. Flat surfaces + an explicit
          // border (below) read cleaner.
          root: { backgroundImage: 'none' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            ...(theme.palette.mode === 'dark' && {
              border: `1px solid ${theme.palette.divider}`,
            }),
          }),
        },
      },
    },
  });
}
