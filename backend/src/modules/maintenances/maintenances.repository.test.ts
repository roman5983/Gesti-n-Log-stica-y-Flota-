import { describe, it, expect, vi } from 'vitest';

// The WHERE / ORDER BY builders are pure; the Prisma client is stubbed out.
vi.mock('../../database/prisma-client', () => ({ prisma: {} }));

import { buildMaintenanceOrderBy, buildMaintenanceWhere } from './maintenances.repository';
import { listMaintenancesQuerySchema } from './maintenances.schemas';

describe('buildMaintenanceWhere — maintenance filters', () => {
  it('filters by vehicle and by maintenance type', () => {
    const where = buildMaintenanceWhere({ vehicleId: 4, maintenanceTypeId: 2 });
    expect(where.vehicleId).toBe(4);
    expect(where.maintenanceTypeId).toBe(2);
  });

  it('the period uses the scheduled date, with an inclusive "to"', () => {
    const where = buildMaintenanceWhere({
      dateFrom: new Date('2026-09-01T00:00:00.000Z'),
      dateTo: new Date('2026-09-07T00:00:00.000Z'),
    });
    expect(where.scheduledAt).toEqual({
      gte: new Date('2026-09-01T00:00:00.000Z'),
      lte: new Date('2026-09-07T23:59:59.999Z'),
    });
  });

  it('restricts nothing without filters', () => {
    const where = buildMaintenanceWhere({});
    expect(where.scheduledAt).toBeUndefined();
    expect(where.status).toBeUndefined();
  });
});

describe('buildMaintenanceOrderBy — maintenance sorting', () => {
  it('defaults to scheduled date, newest first, with an id tiebreaker', () => {
    const q = listMaintenancesQuerySchema.parse({});
    expect(buildMaintenanceOrderBy({ field: q.sortBy, order: q.sortOrder })).toEqual([
      { scheduledAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('by type sorts by the type name, not its id', () => {
    expect(buildMaintenanceOrderBy({ field: 'type', order: 'asc' })[0]).toEqual({
      maintenanceType: { name: 'asc' },
    });
  });

  it('by vehicle sorts by license plate', () => {
    expect(buildMaintenanceOrderBy({ field: 'vehicle', order: 'desc' })[0]).toEqual({
      vehicle: { licensePlate: 'desc' },
    });
  });

  it('by completion date puts unfinished ones last', () => {
    expect(buildMaintenanceOrderBy({ field: 'completedAt', order: 'asc' })[0]).toEqual({
      completedAt: { sort: 'asc', nulls: 'last' },
    });
  });

  it('every order ends in a unique tiebreaker (stable pagination)', () => {
    for (const field of ['type', 'vehicle', 'km', 'completedAt', 'scheduledAt'] as const) {
      const order = buildMaintenanceOrderBy({ field, order: 'asc' });
      expect(Object.keys(order[order.length - 1]!)).toEqual(['id']);
    }
  });

  it('rejects an unknown sort field', () => {
    expect(() => listMaintenancesQuerySchema.parse({ sortBy: 'notes' })).toThrow();
  });
});
