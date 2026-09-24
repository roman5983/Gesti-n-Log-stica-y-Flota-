import { scaleColor } from '@/theme/theme.helpers';
import type { ColorTokens } from '@/theme/theme.types';

/**
 * One color per bar of "Viajes por mes", from the chart scale of the design
 * system: the busiest month gets the lightest tone, the quietest the darkest.
 */
export function barColorsFor(series: { count: number }[], scale: ColorTokens['chart']): string[] {
  if (series.length === 0) return [];
  const counts = series.map((m) => m.count);
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  return counts.map((c) => scaleColor(c, min, max, scale));
}
