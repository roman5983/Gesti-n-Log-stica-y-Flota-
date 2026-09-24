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

export type Rgb = [number, number, number];
