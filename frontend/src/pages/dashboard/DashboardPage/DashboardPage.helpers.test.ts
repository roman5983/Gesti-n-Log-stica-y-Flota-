import { describe, expect, it } from 'vitest';
import { LIGHT } from '@/theme/theme.tokens';
import { barColorsFor } from './DashboardPage.helpers';

describe('barColorsFor (trips per month chart)', () => {
  const scale = LIGHT.chart;

  it('the busiest month is the lightest and the quietest the darkest', () => {
    const colors = barColorsFor([{ count: 3 }, { count: 12 }, { count: 7 }], scale);
    expect(colors[0]).toBe(scale.low.toUpperCase());
    expect(colors[1]).toBe(scale.high.toUpperCase());
    expect(colors).toHaveLength(3);
  });

  it('no data, no bars', () => {
    expect(barColorsFor([], scale)).toEqual([]);
  });
});
