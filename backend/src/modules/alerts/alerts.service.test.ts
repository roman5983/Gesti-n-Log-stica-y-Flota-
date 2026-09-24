import { describe, it, expect, vi, afterEach } from 'vitest';

// scanConditions only reads through the client it receives; the global one is stubbed.
vi.mock('../../database/prisma-client', () => ({ prisma: {} }));

import { scanConditions } from './alerts.service';
import type { DbClient } from '../audit-logs/audit-logs.repository';

const NOW = new Date('2026-09-24T12:00:00.000Z');

/** A client with no drivers, documents, vehicles or maintenances: only trips matter. */
function fakeDb(trips: { id: number; destination: string; departureAt: Date }[]) {
  const tripFindMany = vi.fn().mockResolvedValue(trips);
  const db = {
    driver: { findMany: vi.fn().mockResolvedValue([]) },
    driverDocument: { findMany: vi.fn().mockResolvedValue([]) },
    vehicle: { findMany: vi.fn().mockResolvedValue([]) },
    maintenanceType: { aggregate: vi.fn().mockResolvedValue({ _min: { kmAlert: null } }) },
    maintenance: { findMany: vi.fn().mockResolvedValue([]) },
    trip: { findMany: tripFindMany },
  };
  return { db: db as unknown as DbClient, tripFindMany };
}

describe('scanConditions — VOYAGE_NOT_ASSIGNED', () => {
  afterEach(() => vi.useRealTimers());

  it('asks for pending trips leaving within the next hour (or already late)', async () => {
    vi.useFakeTimers({ now: NOW });
    const { db, tripFindMany } = fakeDb([]);
    await scanConditions(db);
    expect(tripFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'PENDING_ASSIGNMENT', departureAt: { lte: new Date('2026-09-24T13:00:00.000Z') } },
      }),
    );
  });

  it('raises one alert per trip, on the TRIP entity', async () => {
    vi.useFakeTimers({ now: NOW });
    const { db } = fakeDb([{ id: 41, destination: 'Rosario', departureAt: new Date('2026-09-24T12:30:00.000Z') }]);
    const [alert] = await scanConditions(db);
    expect(alert).toEqual({
      alertType: 'VOYAGE_NOT_ASSIGNED',
      entityType: 'TRIP',
      entityId: 41,
      description: 'El viaje #41 a Rosario sale en menos de 1 hora y no tiene chofer/vehículo asignado',
    });
  });

  it('says "ya debía salir" for a trip whose departure already passed', async () => {
    vi.useFakeTimers({ now: NOW });
    const { db } = fakeDb([{ id: 42, destination: 'Córdoba', departureAt: new Date('2026-09-24T08:00:00.000Z') }]);
    const [alert] = await scanConditions(db);
    expect(alert?.description).toBe('El viaje #42 a Córdoba ya debía salir y no tiene chofer/vehículo asignado');
  });
});
