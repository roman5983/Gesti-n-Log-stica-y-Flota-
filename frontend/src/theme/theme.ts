import { alpha, createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import { TINT_ALPHA, tokensFor } from './theme.tokens';
import type { ColorTokens, SidebarTokens, Tone } from './theme.types';
import { TONES } from './theme.data';

/**
 * App theme — built from the design-system tokens in theme-tokens.ts, in light
 * and dark mode.
 *
 * The theme is built by a factory instead of being a module-level constant:
 * the color mode lives in a store (see stores/color-mode-store) and
 * AppThemeProvider rebuilds the theme whenever the mode changes.
 *
 * Besides mapping tokens to MUI palette slots, the component overrides below
 * enforce the design-system rules once, for every screen:
 *  - interactive states: hover / pressed / disabled / keyboard focus;
 *  - colored chips are "soft" (tinted background + dark text of the same hue)
 *    instead of saturated blocks: legible (AA) and calmer (60-30-10);
 *  - containers are delimited by crisp 1px neutral borders instead of blurry
 *    shadows (pixel perfect on low-density screens);
 *  - form controls keep a ≥ 3:1 outline (WCAG 1.4.11).
 */

declare module '@mui/material/styles' {
  interface Palette {
    sidebar: SidebarTokens;
    /** Accent (secondary) color — badges and key metrics, used sparingly. */
    accent: Palette['primary'];
    /** Raw design tokens of the current mode, for the rare component (charts)
     *  that needs more than the MUI palette slots. */
    tokens: ColorTokens;
  }
  interface PaletteOptions {
    sidebar?: SidebarTokens;
    accent?: PaletteOptions['primary'];
    tokens?: ColorTokens;
  }
}

declare module '@mui/material/Chip' {
  interface ChipPropsColorOverrides {
    accent: true;
  }
}

declare module '@mui/material/Button' {
  interface ButtonPropsColorOverrides {
    accent: true;
  }
}

declare module '@mui/material/IconButton' {
  interface IconButtonPropsColorOverrides {
    accent: true;
  }
}

declare module '@mui/material/SvgIcon' {
  interface SvgIconPropsColorOverrides {
    accent: true;
  }
}

/** MUI slot for a tone: `dark` is the hover step and `light` carries the
 *  legible text shade (MUI has no slot for it; read it through toneText). */
function paletteColor(t: ColorTokens[Tone]) {
  return { main: t.main, dark: t.hover, light: t.text, contrastText: t.contrastText };
}

function palette(mode: PaletteMode, tk: ColorTokens) {
  const n = tk.neutral;
  return {
    mode,
    primary: paletteColor(tk.primary),
    // MUI's `secondary` slot is the accent, so third-party components that
    // default to "secondary" follow the design system too.
    secondary: paletteColor(tk.accent),
    accent: paletteColor(tk.accent),
    success: paletteColor(tk.success),
    warning: paletteColor(tk.warning),
    error: paletteColor(tk.error),
    info: paletteColor(tk.info),
    background: { default: n.background, paper: n.surface },
    text: { primary: n.textPrimary, secondary: n.textSecondary, disabled: n.textDisabled },
    divider: n.divider,
    action: {
      hover: alpha(n.textPrimary, 0.06),
      selected: alpha(tk.primary.main, 0.12),
      disabled: n.disabledText,
      disabledBackground: n.disabledBg,
      focus: alpha(tk.primary.main, 0.16),
    },
    sidebar: tk.sidebar,
    tokens: tk,
  };
}

/** Soft chip styles for one tone: tint of the hue + the hue's text shade. */
function softTone(tk: ColorTokens, tone: Tone, mode: PaletteMode) {
  const t = tk[tone];
  return {
    backgroundColor: alpha(t.main, TINT_ALPHA[mode]),
    color: t.text,
    '& .MuiChip-icon, & .MuiChip-deleteIcon': { color: t.text },
  };
}

/** Builds the MUI theme for the given color mode. */
export function buildTheme(mode: PaletteMode): Theme {
  const tk = tokensFor(mode);
  const n = tk.neutral;

  return createTheme({
    palette: palette(mode, tk),
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          // The browser's own widgets (scrollbars, native pickers) follow the mode.
          ':root': { colorScheme: mode },
        },
      },

      // --- Keyboard focus: always visible, never only a color change -------
      MuiButtonBase: {
        styleOverrides: {
          root: {
            '&.Mui-focusVisible': {
              outline: `2px solid ${tk.primary.main}`,
              outlineOffset: 2,
            },
          },
        },
      },

      // --- Buttons: default / hover / pressed / disabled --------------------
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: ({ ownerState }) => {
            const color = ownerState.color;
            if (!color || color === 'inherit' || !TONES.includes(color as Tone)) return {};
            const t = tk[color as Tone];
            if (ownerState.variant === 'contained') {
              return {
                '&:hover': { backgroundColor: t.hover, color: t.stateText },
                '&:active': { backgroundColor: t.active, color: t.stateText },
              };
            }
            // Text and outlined buttons print the color as text → text shade.
            return {
              color: t.text,
              ...(ownerState.variant === 'outlined' && { borderColor: t.main }),
              '&:hover': { backgroundColor: alpha(t.main, 0.08) },
              '&:active': { backgroundColor: alpha(t.main, 0.16) },
            };
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const color = ownerState.color;
            if (!color || !TONES.includes(color as Tone)) return {};
            const t = tk[color as Tone];
            return {
              color: t.text,
              '&:hover': { backgroundColor: alpha(t.main, 0.1) },
              '&:active': { backgroundColor: alpha(t.main, 0.2) },
            };
          },
        },
      },

      // --- Chips: soft tones, legible text -----------------------------------
      MuiChip: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const color = ownerState.color;
            if (ownerState.variant === 'outlined') {
              if (!color || color === 'default') return { borderColor: n.border };
              const t = tk[color as Tone];
              return { borderColor: t.main, color: t.text };
            }
            if (!color || color === 'default') {
              return { backgroundColor: n.subtle, color: n.textPrimary };
            }
            if (!TONES.includes(color as Tone)) return {};
            const clickable = ownerState.clickable
              ? { '&:hover': { backgroundColor: alpha(tk[color as Tone].main, TINT_ALPHA[mode] + 0.08) } }
              : {};
            return { ...softTone(tk, color as Tone, mode), ...clickable };
          },
        },
      },

      // --- Containers: flat + crisp neutral border --------------------------
      MuiPaper: {
        styleOverrides: {
          // MUI tints elevated surfaces in dark mode with a white overlay;
          // flat surfaces read cleaner.
          root: { backgroundImage: 'none' },
          // elevation 1 = every page-level container (cards, tables, tabs).
          // Menus and dialogs keep their shadow: they float above the page.
          elevation1: { boxShadow: 'none', border: `1px solid ${n.border}` },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 1 },
      },
      MuiDialog: {
        styleOverrides: {
          paper: { border: `1px solid ${n.border}` },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },

      // --- Tables ------------------------------------------------------------
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: n.divider },
          head: { fontWeight: 600, color: n.textPrimary },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&.MuiTableRow-hover:hover': { backgroundColor: alpha(n.textPrimary, 0.04) },
          },
        },
      },

      // --- Form controls: outline with ≥ 3:1 --------------------------------
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': { borderColor: n.controlBorder },
            '&:hover:not(.Mui-disabled):not(.Mui-error) .MuiOutlinedInput-notchedOutline': {
              borderColor: n.textPrimary,
            },
            '&.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: n.disabledBg },
          },
        },
      },

      // --- Navigation --------------------------------------------------------
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            color: n.textSecondary,
            '&.Mui-selected': { color: tk.primary.text },
          },
        },
      },
      MuiLink: {
        styleOverrides: { root: { color: tk.primary.text } },
      },

      // --- Alerts: tinted banner, text in the tone's text shade --------------
      MuiAlert: {
        styleOverrides: {
          standard: ({ ownerState }) => {
            const tone = (ownerState.severity ?? 'success') as Tone;
            const t = tk[tone];
            return {
              backgroundColor: alpha(t.main, TINT_ALPHA[mode]),
              color: n.textPrimary,
              border: `1px solid ${alpha(t.main, 0.4)}`,
              '& .MuiAlert-icon': { color: t.text },
            };
          },
          // Pop-up notices (NotificationProvider): solid tone + its tested
          // contrastText, instead of MUI's fixed white (fails on amber/green).
          filled: ({ ownerState }) => {
            const t = tk[(ownerState.severity ?? 'success') as Tone];
            return {
              backgroundColor: t.main,
              color: t.contrastText,
              '& .MuiAlert-icon, & .MuiAlert-action': { color: t.contrastText },
            };
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          // Inverted neutrals: dark bubble in light mode and vice versa.
          tooltip: {
            backgroundColor: n.textPrimary,
            color: n.background,
            fontSize: '0.8125rem',
          },
        },
      },
    },
  });
}
