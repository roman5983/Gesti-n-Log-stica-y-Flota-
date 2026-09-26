import { describe, it, expect } from 'vitest';
import { statusFromParams } from './TripsPage.helpers';

describe('trips statusFromParams', () => {
  it('returns a valid status when the param matches STATUS_OPTIONS', () => {
    expect(statusFromParams('PENDING_ASSIGNMENT')).toBe('PENDING_ASSIGNMENT');
    expect(statusFromParams('IN_PROGRESS')).toBe('IN_PROGRESS');
    expect(statusFromParams('COMPLETED')).toBe('COMPLETED');
    expect(statusFromParams('CANCELLED')).toBe('CANCELLED');
  });

  it('returns empty string for null (no param)', () => {
    expect(statusFromParams(null)).toBe('');
  });

  it('returns empty string for an unrecognized status', () => {
    expect(statusFromParams('DELETED')).toBe('');
    expect(statusFromParams('in_progress')).toBe(''); // case-sensitive
    expect(statusFromParams('')).toBe('');
  });
});
