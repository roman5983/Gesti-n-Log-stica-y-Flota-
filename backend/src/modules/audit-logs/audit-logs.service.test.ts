import { describe, it, expect } from 'vitest';
import { sanitize } from './audit-logs.service';

describe('audit sanitize', () => {
  it('redacts sensitive fields at the top level', () => {
    expect(sanitize({ name: 'Ana', passwordHash: 'x' })).toEqual({
      name: 'Ana',
      passwordHash: '[REDACTED]',
    });
  });

  it('redacts sensitive fields in nested objects and arrays', () => {
    const out = sanitize({
      user: { email: 'a@b.c', encryptedPassword: 'secret', profile: { tokenHash: 't' } },
      sessions: [{ id: 1, tokenHash: 'abc' }, { id: 2 }],
    });
    expect(out).toEqual({
      user: { email: 'a@b.c', encryptedPassword: '[REDACTED]', profile: { tokenHash: '[REDACTED]' } },
      sessions: [{ id: 1, tokenHash: '[REDACTED]' }, { id: 2 }],
    });
  });

  it('keeps non-sensitive data, primitives and dates intact', () => {
    const out = sanitize({ at: new Date('2026-01-01T00:00:00Z'), n: 3, list: [1, 'a', null] });
    expect(out).toEqual({ at: '2026-01-01T00:00:00.000Z', n: 3, list: [1, 'a', null] });
  });

  it('returns undefined for null/undefined', () => {
    expect(sanitize(undefined)).toBeUndefined();
    expect(sanitize(null)).toBeUndefined();
  });
});
