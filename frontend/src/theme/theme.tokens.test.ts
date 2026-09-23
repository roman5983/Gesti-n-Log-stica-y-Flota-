import { describe, expect, it } from 'vitest';
import { DARK, LIGHT, TINT_ALPHA } from './theme.tokens';
import { blendOver, contrastRatio, mixHex, scaleColor } from './theme.helpers';
import type { ColorTokens, Tone } from './theme.types';

/**
 * Accessibility contract of the design system (WCAG 2.1 AA): every token pair
 * the UI actually draws is checked here, in both color modes. If someone tweaks
 * a hex value and breaks legibility, this suite fails before it reaches a user.
 */

const TEXT_AA = 4.5; // normal text
const GRAPHIC_AA = 3; // icons, component boundaries, chart marks, large text

const TONES: Tone[] = ['primary', 'accent', 'success', 'warning', 'error', 'info'];
const MODES: [string, ColorTokens, 'light' | 'dark'][] = [
  ['light', LIGHT, 'light'],
  ['dark', DARK, 'dark'],
];

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // The team's reference values (spec of 23/09/2026).
    expect(contrastRatio('#2563EB', '#FFFFFF')).toBeGreaterThan(5.1);
    expect(contrastRatio('#1F2937', '#FFFFFF')).toBeGreaterThan(14);
  });
});

describe.each(MODES)('tokens — %s mode', (_name, tk, mode) => {
  const n = tk.neutral;
  const grounds = { background: n.background, surface: n.surface };

  it('never uses pure black (halation)', () => {
    const all = JSON.stringify(tk).toUpperCase();
    expect(all).not.toContain('#000000');
    expect(n.textPrimary).not.toBe('#FFFFFF');
  });

  it.each(Object.entries(grounds))('text hierarchy is legible on %s', (_g, bg) => {
    expect(contrastRatio(n.textPrimary, bg)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(n.textSecondary, bg)).toBeGreaterThanOrEqual(TEXT_AA);
  });

  it.each(Object.entries(grounds))('form control outline ≥ 3:1 on %s', (_g, bg) => {
    expect(contrastRatio(n.controlBorder, bg)).toBeGreaterThanOrEqual(GRAPHIC_AA);
  });

  it.each(TONES)('%s: text on the color in its three states', (tone) => {
    const t = tk[tone];
    expect(contrastRatio(t.contrastText, t.main)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(t.stateText, t.hover)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(t.stateText, t.active)).toBeGreaterThanOrEqual(TEXT_AA);
  });

  it.each(TONES)('%s: its text shade is legible on background, surface and its own tint', (tone) => {
    const t = tk[tone];
    for (const bg of Object.values(grounds)) {
      expect(contrastRatio(t.text, bg)).toBeGreaterThanOrEqual(TEXT_AA);
      // Soft chip / KPI badge: tint of the hue painted over the ground.
      const tint = blendOver(t.main, TINT_ALPHA[mode], bg);
      expect(contrastRatio(t.text, tint)).toBeGreaterThanOrEqual(TEXT_AA);
      // Alert banner: primary text over the same tint.
      expect(contrastRatio(n.textPrimary, tint)).toBeGreaterThanOrEqual(TEXT_AA);
    }
  });

  it('primary works as a focus ring (≥ 3:1)', () => {
    for (const bg of Object.values(grounds)) {
      expect(contrastRatio(tk.primary.main, bg)).toBeGreaterThanOrEqual(GRAPHIC_AA);
    }
  });

  it('sidebar: items, title and active item are legible', () => {
    const s = tk.sidebar;
    expect(contrastRatio(s.text, s.bg)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(s.title, s.bg)).toBeGreaterThanOrEqual(TEXT_AA);
    expect(contrastRatio(s.activeText, s.activeBg)).toBeGreaterThanOrEqual(TEXT_AA);
  });

  it('tooltip (inverted neutrals) is legible', () => {
    expect(contrastRatio(n.background, n.textPrimary)).toBeGreaterThanOrEqual(TEXT_AA);
  });

  it('the whole chart scale stands out from the surface (≥ 3:1)', () => {
    for (let i = 0; i <= 10; i++) {
      const c = mixHex(tk.chart.low, tk.chart.high, i / 10);
      expect(contrastRatio(c, n.surface)).toBeGreaterThanOrEqual(GRAPHIC_AA);
    }
  });
});

describe('scaleColor (trips per month chart)', () => {
  const scale = LIGHT.chart;

  it('the largest value is the lightest tone and the smallest the darkest', () => {
    expect(scaleColor(40, 5, 40, scale)).toBe(scale.high.toUpperCase());
    expect(scaleColor(5, 5, 40, scale)).toBe(scale.low.toUpperCase());
    // Lighter = more contrast against black: monotonic along the series.
    const dark = contrastRatio(scaleColor(10, 5, 40, scale), '#111827');
    const light = contrastRatio(scaleColor(30, 5, 40, scale), '#111827');
    expect(light).toBeGreaterThan(dark);
  });

  it('a flat series uses the middle tone', () => {
    expect(scaleColor(7, 7, 7, scale)).toBe(mixHex(scale.low, scale.high, 0.5));
  });
});
