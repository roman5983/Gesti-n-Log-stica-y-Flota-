import { describe, it, expect } from 'vitest';
import {
  idParamSchema,
  paginationSchema,
  searchSchema,
  sortOrderSchema,
  paginationMeta,
} from './schemas';

describe('idParamSchema', () => {
  it('coerces a string id to a positive integer', () => {
    const parsed = idParamSchema.parse({ id: '42' });
    expect(parsed.id).toBe(42);
  });

  it('rejects zero', () => {
    expect(() => idParamSchema.parse({ id: '0' })).toThrow();
  });

  it('rejects negative ids', () => {
    expect(() => idParamSchema.parse({ id: '-1' })).toThrow();
  });

  it('rejects non-integer values', () => {
    expect(() => idParamSchema.parse({ id: '3.5' })).toThrow();
  });
});

describe('paginationSchema', () => {
  it('defaults page to 1 and limit to 10', () => {
    const parsed = paginationSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(10);
  });

  it('coerces string values from query params', () => {
    const parsed = paginationSchema.parse({ page: '3', limit: '25' });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(25);
  });

  it('rejects page < 1', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
  });

  it('rejects limit > 100', () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects limit < 1', () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
  });
});

describe('searchSchema', () => {
  it('trims whitespace', () => {
    const parsed = searchSchema.parse('  Ford  ');
    expect(parsed).toBe('Ford');
  });

  it('converts blank to undefined (no search)', () => {
    expect(searchSchema.parse('')).toBeUndefined();
    expect(searchSchema.parse('   ')).toBeUndefined();
  });

  it('passes through a normal search term', () => {
    expect(searchSchema.parse('Pérez')).toBe('Pérez');
  });

  it('rejects strings over 100 chars', () => {
    expect(() => searchSchema.parse('x'.repeat(101))).toThrow();
  });

  it('passes undefined through (optional)', () => {
    expect(searchSchema.parse(undefined)).toBeUndefined();
  });
});

describe('sortOrderSchema', () => {
  it('defaults to desc', () => {
    expect(sortOrderSchema.parse(undefined)).toBe('desc');
  });

  it('accepts asc and desc', () => {
    expect(sortOrderSchema.parse('asc')).toBe('asc');
    expect(sortOrderSchema.parse('desc')).toBe('desc');
  });

  it('rejects invalid values', () => {
    expect(() => sortOrderSchema.parse('random')).toThrow();
  });
});

describe('paginationMeta', () => {
  it('echoes page, limit and total', () => {
    const meta = paginationMeta({ page: 2, limit: 10 }, 57);
    expect(meta).toEqual({ page: 2, limit: 10, total: 57 });
  });

  it('works with zero results', () => {
    const meta = paginationMeta({ page: 1, limit: 10 }, 0);
    expect(meta).toEqual({ page: 1, limit: 10, total: 0 });
  });
});
