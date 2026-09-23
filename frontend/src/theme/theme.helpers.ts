import type { ColorTokens, Rgb, Tone } from './theme.types';
import type { Theme } from '@mui/material/styles';

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: Rgb): string {
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
export function luminance(hex: string): number {
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

/**
 * Tone of a color when written as text or drawn as a small icon (the legible
 * `text` shade). Falls back to MUI's `dark` slot when rendered under a theme
 * that was not built here (e.g. component tests with the default MUI theme).
 */
export function toneText(theme: Theme, tone: Tone): string {
  return theme.palette.tokens?.[tone].text ?? theme.palette[tone === 'accent' ? 'secondary' : tone].dark;
}

/** Base color of a tone (fills, borders, tints). Same fallback as toneText. */
export function toneMain(theme: Theme, tone: Tone): string {
  return (theme.palette.tokens?.[tone] ?? theme.palette[tone === 'accent' ? 'secondary' : tone]).main;
}
