import { describe, it, expect } from 'vitest';
import { statusFromParams } from './VehiclesPage.helpers';

describe('vehicles statusFromParams', () => {
  it('returns a valid status when the param matches STATUS_OPTIONS', () => {
    expect(statusFromParams('AVAILABLE')).toBe('AVAILABLE');
    expect(statusFromParams('INACTIVE')).toBe('INACTIVE');
    expect(statusFromParams('IN_WORKSHOP')).toBe('IN_WORKSHOP');
    expect(statusFromParams('ON_TRIP')).toBe('ON_TRIP');
  });

  it('returns empty string for null (no param)', () => {
    expect(statusFromParams(null)).toBe('');
  });

  it('returns empty string for an unrecognized status', () => {
    expect(statusFromParams('FLYING')).toBe('');
    expect(statusFromParams('available')).toBe(''); // case-sensitive
    expect(statusFromParams('')).toBe('');
  });
});
