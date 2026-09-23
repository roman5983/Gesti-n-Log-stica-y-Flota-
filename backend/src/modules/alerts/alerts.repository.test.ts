import { describe, it, expect, vi } from 'vitest';

// The WHERE / ORDER BY builders are pure; the Prisma client is stubbed out.
vi.mock('../../database/prisma-client', () => ({ prisma: {} }));

import { buildAlertOrderBy, buildAlertWhere } from './alerts.repository';
import { listAlertsQuerySchema } from './alerts.schemas';

describe('buildAlertWhere — alert filters', () => {
  it('"alerts of vehicle X" is the VEHICLE entity with that id', () => {
    const where = buildAlertWhere({ status: 'PENDING', vehicleId: 7 });
    expect(where).toMatchObject({ status: 'PENDING', entityType: 'VEHICLE', entityId: 7 });
  });

  it('the period uses the date the alert was raised, with an inclusive "to"', () => {
    const where = buildAlertWhere({
      dateFrom: new Date('2026-09-21T00:00:00.000Z'),
      dateTo: new Date('2026-09-27T00:00:00.000Z'),
    });
    expect(where.raisedAt).toEqual({
      gte: new Date('2026-09-21T00:00:00.000Z'),
      lte: new Date('2026-09-27T23:59:59.999Z'),
    });
  });

  it('filters by alert type', () => {
    expect(buildAlertWhere({ alertType: 'LICENSE_EXPIRED' }).alertType).toBe('LICENSE_EXPIRED');
  });
});

describe('buildAlertOrderBy — alert sorting', () => {
  it('without a field keeps the inbox order: pending and newest first', () => {
    const q = listAlertsQuerySchema.parse({});
    expect(buildAlertOrderBy({ field: q.sortBy, order: q.sortOrder })).toEqual([
      { status: 'asc' },
      { raisedAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('by date follows the chosen direction', () => {
    expect(buildAlertOrderBy({ field: 'raisedAt', order: 'asc' })).toEqual([
      { raisedAt: 'asc' },
      { id: 'asc' },
    ]);
  });

  it('by type groups by type, newest first within each', () => {
    expect(buildAlertOrderBy({ field: 'alertType', order: 'asc' })).toEqual([
      { alertType: 'asc' },
      { raisedAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('rejects an unknown sort field', () => {
    expect(() => listAlertsQuerySchema.parse({ sortBy: 'description' })).toThrow();
  });
});
