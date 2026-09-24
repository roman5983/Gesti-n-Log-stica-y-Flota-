import type { PaletteMode } from '@mui/material';
import type { ColorTokens } from './theme.types';

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

