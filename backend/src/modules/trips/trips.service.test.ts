import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tripsService } from './trips.service';
import { BusinessRuleError } from '../../shared/errors/app-error';

/**
 * Concurrency guard for trip assignment. No database: the race is simulated by
 * making the read taken before the transaction disagree with the read taken
 * under the trip lock — what happens when a cancel commits in between.
 */

const t = vi.hoisted(() => {
  const TX = { __tx: true };
  return {
    TX,
    order: [] as string[],
    tripsRepository: {
      findById: vi.fn(),
      lockTrip: vi.fn(),
      lockDriver: vi.fn(),
      hasActiveTrip: vi.fn(),
      pickAvailableVehicle: vi.fn(),
      hasAvailableVehicle: vi.fn(),
      update: vi.fn(),
    },
    driversRepository: { findById: vi.fn() },
    documentsRepository: { hasExpiredActive: vi.fn() },
    vehiclesRepository: { findById: vi.fn(), update: vi.fn() },
    record: vi.fn(),
  };
});

vi.mock('../../database/prisma-client', () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(t.TX) },
}));
vi.mock('./trips.repository', () => ({ tripsRepository: t.tripsRepository }));
vi.mock('../drivers/drivers.repository', () => ({ driversRepository: t.driversRepository }));
vi.mock('../documents/documents.repository', () => ({ documentsRepository: t.documentsRepository }));
vi.mock('../vehicles/vehicles.repository', () => ({ vehiclesRepository: t.vehiclesRepository }));
vi.mock('../audit-logs/audit-logs.service', () => ({ auditLogsService: { record: t.record } }));

function trip(status: string) {
  return {
    id: 1,
    origin: 'Rosario',
    destination: 'Córdoba',
    departureAt: new Date('2026-10-01T11:00:00Z'),
    status,
    estimatedDistanceKm: null,
    estimatedTimeMin: null,
    notes: null,
    operator: { id: 2, name: 'Operador' },
    driver: null,
    driverId: null,
    vehicle: null,
    vehicleId: null,
    departureKm: null,
    arrivalKm: null,
    assignedAt: null,
    finishedAt: null,
    createdAt: new Date('2026-09-20T00:00:00Z'),
  };
}

/** Pre-transaction read says `before`; the read under the lock says `underLock`. */
function stateChangesConcurrently(before: string, underLock: string) {
  t.tripsRepository.findById.mockImplementation(async (_id: number, db?: unknown) => {
    t.order.push(db === t.TX ? 'read-in-tx' : 'read-outside');
    return trip(db === t.TX ? underLock : before);
  });
}

describe('tripsService.assign — decides from the locked trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    t.order.length = 0;
    t.tripsRepository.lockTrip.mockImplementation(async () => {
      t.order.push('lock-trip');
    });
    // An eligible driver and an available vehicle, so only the trip state matters.
    t.driversRepository.findById.mockResolvedValue({
      userId: 5,
      user: { isActive: true, name: 'Juan' },
      licenseExpiryDate: new Date('2099-01-01T00:00:00Z'),
    });
    t.documentsRepository.hasExpiredActive.mockResolvedValue(false);
    t.tripsRepository.hasActiveTrip.mockResolvedValue(false);
    t.tripsRepository.pickAvailableVehicle.mockResolvedValue(7);
    t.vehiclesRepository.findById.mockResolvedValue({ id: 7, accumulatedKm: 1000 });
    t.tripsRepository.update.mockImplementation(async () => trip('IN_PROGRESS'));
  });

  it('is rejected if the trip was cancelled in between, without touching any vehicle', async () => {
    // Before the fix, the state was only checked outside the transaction and
    // the assignment overwrote the cancel: the trip came back IN_PROGRESS.
    stateChangesConcurrently('PENDING_ASSIGNMENT', 'CANCELLED');

    await expect(tripsService.assign(1, { driverId: 5 }, 99)).rejects.toBeInstanceOf(
      BusinessRuleError,
    );
    expect(t.tripsRepository.pickAvailableVehicle).not.toHaveBeenCalled();
    expect(t.tripsRepository.update).not.toHaveBeenCalled();
    expect(t.vehiclesRepository.update).not.toHaveBeenCalled();
  });

  it('locks the trip before re-reading it, and before locking the driver', async () => {
    stateChangesConcurrently('PENDING_ASSIGNMENT', 'PENDING_ASSIGNMENT');
    t.tripsRepository.lockDriver.mockImplementation(async () => {
      t.order.push('lock-driver');
    });

    await tripsService.assign(1, { driverId: 5 }, 99);

    expect(t.order).toEqual(['read-outside', 'lock-trip', 'read-in-tx', 'lock-driver']);
    expect(t.vehiclesRepository.update).toHaveBeenCalledWith(7, { status: 'ON_TRIP' }, t.TX);
  });
});
