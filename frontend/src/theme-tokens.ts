import type { PaletteMode } from '@mui/material';

/**
 * Color tokens of the design system — the single place where hex values live.
 *
 * Every screen reads colors through the MUI theme (built from these tokens in
 * theme.ts); no component should hardcode a hex value. The palette is split in
 * the four functional groups of the design system:
 *
 *  - PRIMARY (brand / actions): reserved for interactive elements — main
 *    buttons (CTA), links and active states (selected tab, active menu item).
 *    Never used as decoration, so that "blue" always means "you can click it".
 *  - ACCENT (secondary): used sparingly for badges and key metrics that need
 *    secondary attention (role badge, avatar, admin totals on the dashboard).
 *  - NEUTRALS: backgrounds, containers, borders, dividers and the whole text
 *    hierarchy. They cover ~90% of the screen (60-30-10 rule: 60% dominant
 *    neutral background, 30% secondary neutral for text/borders, 10% primary
 *    or accent). No pure black (#000) anywhere: text is a very dark gray to
 *    avoid halation on white screens.
 *  - SEMANTIC (system states): success green, error red, warning amber and
 *    info cyan. Info is cyan — not the primary blue — so a status never reads
 *    as a button.
 *
 * Each interactive color has four states (visibility of system status):
 * default, hover (~10% darker), active/pressed (~20% darker) and disabled
 * (flat gray, deliberately without contrast).
 *
 * Contrast (WCAG 2.1): `theme-tokens.test.ts` checks every pair that carries
 * text (≥ 4.5:1, level AA) or an essential graphic / component boundary
 * (≥ 3:1). The success and warning base colors (#16A34A, #D97706) only reach
 * ~3.2:1 on white: valid for icons, borders and fills, but not for small text.
 * That is why every semantic color also has a `text` shade used whenever the
 * color is written as text (700 step; 800 for success / warning / info, whose
 * 700 falls to ~4.0:1 over their own tint on a gray container), and why `contrastText` over those
 * base colors is dark gray instead of white (switching to white on the darker
 * hover/active steps — see `stateText`).
 */

/** A color that can carry an action or a status. */
export interface ToneTokens {
  /** Base color: fills, icons, borders, focus rings. */
  main: string;
  /** Hover state (≈10% darker in light mode; one step lighter in dark mode). */
  hover: string;
  /** Pressed state (≈20% darker in light mode; two steps lighter in dark mode). */
  active: string;
  /** Text/icon drawn on top of `main`. */
  contrastText: string;
  /** Text/icon drawn on top of `hover` and `active`. Usually the same as
   *  `contrastText`; it differs for success / warning / info in light mode,
   *  whose base is light enough for dark text but whose darker hover/active
   *  steps need white text to keep 4.5:1. */
  stateText: string;
  /** The color used as text on a neutral surface or on its own soft tint. */
  text: string;
}

export interface NeutralTokens {
  /** Page background (dominant neutral, ~60%). */
  background: string;
  /** Containers: cards, tables, dialogs, sections. */
  surface: string;
  /** Subtle fill for hovered rows / soft chips of the default tone. */
  subtle: string;
  /** Text hierarchy. */
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  /** Crisp outline of containers (cards, tables, menus). */
  border: string;
  /** Internal separators (table rows, list items). */
  divider: string;
  /** Outline of form controls — needs ≥ 3:1 (WCAG 1.4.11). */
  controlBorder: string;
  /** Disabled controls: flat gray, intentionally low contrast. */
  disabledBg: string;
  disabledText: string;
}

export interface SidebarTokens {
  bg: string;
  title: string;
  text: string;
  hoverBg: string;
  /** The active item is an interactive state → primary. */
  activeBg: string;
  activeText: string;
  divider: string;
}

export interface ColorTokens {
  primary: ToneTokens;
  accent: ToneTokens;
  success: ToneTokens;
  warning: ToneTokens;
  error: ToneTokens;
  info: ToneTokens;
  neutral: NeutralTokens;
  sidebar: SidebarTokens;
  /**
   * Scale for quantitative charts (dashboard "Viajes por mes"): `low` paints
   * the smallest value and `high` the largest. Both ends keep ≥ 3:1 against
   * the surface they are drawn on.
   */
  chart: { low: string; high: string };
}

/** Semantic tones a chip / badge / icon can take. */
export type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info';

// ---------------------------------------------------------------------------
// Light mode — the reference palette agreed by the team (23/09/2026).
// ---------------------------------------------------------------------------

export const LIGHT: ColorTokens = {
  primary: { main: '#2563EB', hover: '#1D4ED8', active: '#1E40AF', contrastText: '#FFFFFF', stateText: '#FFFFFF', text: '#1D4ED8' },
  accent: { main: '#7C3AED', hover: '#6D28D9', active: '#5B21B6', contrastText: '#FFFFFF', stateText: '#FFFFFF', text: '#6D28D9' },
  success: { main: '#16A34A', hover: '#15803D', active: '#166534', contrastText: '#111827', stateText: '#FFFFFF', text: '#166534' },
  warning: { main: '#D97706', hover: '#B45309', active: '#92400E', contrastText: '#111827', stateText: '#FFFFFF', text: '#92400E' },
  error: { main: '#DC2626', hover: '#B91C1C', active: '#991B1B', contrastText: '#FFFFFF', stateText: '#FFFFFF', text: '#B91C1C' },
  info: { main: '#0891B2', hover: '#0E7490', active: '#155E75', contrastText: '#111827', stateText: '#FFFFFF', text: '#155E75' },
  neutral: {
    background: '#FFFFFF',
    surface: '#F3F4F6',
    subtle: '#E5E7EB',
    textPrimary: '#1F2937',
    textSecondary: '#4B5563',
    textDisabled: '#9CA3AF',
    border: '#D1D5DB',
    divider: '#E5E7EB',
    controlBorder: '#6B7280',
    disabledBg: '#E5E7EB',
    disabledText: '#9CA3AF',
  },
  sidebar: {
    bg: '#111827',
    title: '#F9FAFB',
    text: '#D1D5DB',
    hoverBg: 'rgba(255, 255, 255, 0.06)',
    activeBg: '#2563EB',
    activeText: '#FFFFFF',
    divider: 'rgba(255, 255, 255, 0.10)',
  },
  chart: { low: '#1E3A8A', high: '#3B82F6' },
};

// ---------------------------------------------------------------------------
// Dark mode — same roles, re-tuned for dark surfaces. Saturated 600 steps
// fail contrast over dark gray, so actions/states move to the 400 steps with
// dark text on top, and hover/active go *lighter* (on a dark UI "more
// emphasis" means more light).
// ---------------------------------------------------------------------------

export const DARK: ColorTokens = {
  primary: { main: '#60A5FA', hover: '#93C5FD', active: '#BFDBFE', contrastText: '#111827', stateText: '#111827', text: '#93C5FD' },
  accent: { main: '#A78BFA', hover: '#C4B5FD', active: '#DDD6FE', contrastText: '#111827', stateText: '#111827', text: '#C4B5FD' },
  success: { main: '#4ADE80', hover: '#86EFAC', active: '#BBF7D0', contrastText: '#111827', stateText: '#111827', text: '#86EFAC' },
  warning: { main: '#FBBF24', hover: '#FCD34D', active: '#FDE68A', contrastText: '#111827', stateText: '#111827', text: '#FCD34D' },
  error: { main: '#F87171', hover: '#FCA5A5', active: '#FECACA', contrastText: '#111827', stateText: '#111827', text: '#FCA5A5' },
  info: { main: '#22D3EE', hover: '#67E8F9', active: '#A5F3FC', contrastText: '#111827', stateText: '#111827', text: '#67E8F9' },
  neutral: {
    background: '#111827',
    surface: '#1F2937',
    subtle: '#374151',
    textPrimary: '#F3F4F6',
    textSecondary: '#9CA3AF',
    textDisabled: '#6B7280',
    border: '#374151',
    divider: '#374151',
    controlBorder: '#9CA3AF',
    disabledBg: '#374151',
    disabledText: '#6B7280',
  },
  sidebar: {
    bg: '#0B1220',
    title: '#F9FAFB',
    text: '#D1D5DB',
    hoverBg: 'rgba(255, 255, 255, 0.06)',
    activeBg: '#60A5FA',
    activeText: '#111827',
    divider: 'rgba(255, 255, 255, 0.08)',
  },
  chart: { low: '#3B82F6', high: '#BFDBFE' },
};

export function tokensFor(mode: PaletteMode): ColorTokens {
  return mode === 'dark' ? DARK : LIGHT;
}

/** Opacity of the soft tint behind a colored chip / icon badge. */
export const TINT_ALPHA: Record<PaletteMode, number> = { light: 0.12, dark: 0.18 };

// ---------------------------------------------------------------------------
// Color math (also used by the contrast tests).
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Linear interpolation between two hex colors; `t` in [0, 1]. */
export function mixHex(from: string, to: string, t: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const k = Math.min(1, Math.max(0, t));
  return rgbToHex([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
}

/** `color` painted with `alpha` opacity over an opaque `background`. */
export function blendOver(color: string, alpha: number, background: string): string {
  return mixHex(background, color, alpha);
}

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.1 contrast ratio between two opaque colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Color of one bar in a quantitative chart: the largest value gets
 * `chart.high` (lighter), the smallest `chart.low` (darker), everything in
 * between is interpolated. A flat series (all equal, or a single value) uses
 * the middle of the scale.
 */
export function scaleColor(value: number, min: number, max: number, scale: ColorTokens['chart']): string {
  const t = max === min ? 0.5 : (value - min) / (max - min);
  return mixHex(scale.low, scale.high, t);
}
