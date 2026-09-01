import { describe, it, expect } from 'vitest';
import { homePathForRole } from './guards';

describe('homePathForRole', () => {
  it('sends admins and operators to the dashboard', () => {
    expect(homePathForRole('ADMIN')).toBe('/dashboard');
    expect(homePathForRole('OPERATOR')).toBe('/dashboard');
  });

  it('sends drivers to their current trip', () => {
    expect(homePathForRole('DRIVER')).toBe('/mi-viaje');
  });
});
