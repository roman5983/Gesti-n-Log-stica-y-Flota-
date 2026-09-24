import { describe, it, expect, vi } from 'vitest';

// The repository module imports the Prisma client at load time; the WHERE
// builder is pure, so the client is replaced by an empty stub.
vi.mock('../../database/prisma-client', () => ({ prisma: {} }));

import { buildTripWhere } from './trips.repository';
import { listTripsQuerySchema } from './trips.schemas';

describe('buildTripWhere — trips search box (driver or destination)', () => {
  it('adds no text condition without a search', () => {
    expect(buildTripWhere({}).OR).toBeUndefined();
  });

  it("matches the destination OR the driver's name", () => {
    const where = buildTripWhere({ search: 'Rosario' });
    expect(where.OR).toEqual([
      { destination: { contains: 'Rosario' } },
      { driver: { user: { name: { contains: 'Rosario' } } } },
    ]);
  });

  it('treats % and _ as literal characters, not LIKE wildcards', () => {
    const where = buildTripWhere({ search: '50%_' });
    expect(where.OR?.[0]).toEqual({ destination: { contains: '50\\%\\_' } });
  });

  it('combines with the other filters (logical AND)', () => {
    const where = buildTripWhere({ search: 'Pérez', status: 'IN_PROGRESS' });
    expect(where.status).toBe('IN_PROGRESS');
    expect(where.OR).toHaveLength(2);
  });
});

describe('listTripsQuerySchema.search', () => {
  it('trims spaces and treats blank text as "no search"', () => {
    expect(listTripsQuerySchema.parse({ search: '  Rosario ' }).search).toBe('Rosario');
    expect(listTripsQuerySchema.parse({ search: '   ' }).search).toBeUndefined();
    expect(listTripsQuerySchema.parse({}).search).toBeUndefined();
  });

  it('rejects searches longer than 100 characters', () => {
    expect(() => listTripsQuerySchema.parse({ search: 'x'.repeat(101) })).toThrow();
  });
});
