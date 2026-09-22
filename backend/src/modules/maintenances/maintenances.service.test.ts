import { beforeEach, describe, expect, it, vi } from 'vitest';
import { maintenancesService } from './maintenances.service';
import { BusinessRuleError } from '../../shared/errors/app-error';

/**
 * Concurrency guards for the maintenance state machine. There is no database
 * here: the race is simulated by making the read taken *before* the
 * transaction disagree with the read taken *under the lock* — exactly what
 * happens when another operator's transition commits in between.
 */

const m = vi.hoisted(() => {
  const TX = { __tx: true };
  return {
    TX,
    order: [] as string[],
    maintenancesRepository: {
      findById: vi.fn(),
      lockMaintenance: vi.fn(),
      lockVehicle: vi.fn(),
      update: vi.fn(),
    },
    vehiclesRepository: { findById: vi.fn(), update: vi.fn() },
    record: vi.fn(),
  };
});

vi.mock('../../database/prisma-client', () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.TX) },
}));
vi.mock('./maintenances.repository', () => ({ maintenancesRepository: m.maintenancesRepository }));
vi.mock('../vehicles/vehicles.repository', () => ({ vehiclesRepository: m.vehiclesRepository }));
vi.mock('../audit-logs/audit-logs.service', () => ({ auditLogsService: { record: m.record } }));

function maintenance(status: string) {
  return {
    id: 1,
    vehicleId: 7,
    maintenanceTypeId: 2,
    vehicle: { id: 7, licensePlate: 'AAA111', model: 'Test' },
    maintenanceType: { id: 2, name: 'Service' },
    status,
    scheduledAt: new Date('2026-09-01T00:00:00Z'),
    completedAt: null,
    km: 1000,
    notes: null,
    nextMaintenanceKm: null,
    attachments: [],
  };
}

/** Pre-transaction read says `before`; the read under the lock says `underLock`. */
function stateChangesConcurrently(before: string, underLock: string) {
  m.maintenancesRepository.findById.mockImplementation(async (_id: number, db?: unknown) => {
    m.order.push(db === m.TX ? 'read-in-tx' : 'read-outside');
    return maintenance(db === m.TX ? underLock : before);
  });
}

describe('maintenancesService — transitions decide from the locked row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.order.length = 0;
    m.maintenancesRepository.lockMaintenance.mockImplementation(async () => {
      m.order.push('lock');
    });
    m.maintenancesRepository.update.mockImplementation(async (_id: number, data: { status: string }) =>
      maintenance(data.status),
    );
  });

  it('takes the lock before reading the state it decides on', async () => {
    stateChangesConcurrently('PENDING', 'PENDING');
    await maintenancesService.cancel(1, 99);
    expect(m.order).toEqual(['read-outside', 'lock', 'read-in-tx']);
  });

  it('cancel releases the vehicle if a start committed in between', async () => {
    // Before the fix, cancel decided from a stale PENDING read, did not release
    // the vehicle, and left it IN_WORKSHOP with its maintenance CANCELLED.
    stateChangesConcurrently('PENDING', 'IN_PROGRESS');

    await maintenancesService.cancel(1, 99);

    expect(m.vehiclesRepository.update).toHaveBeenCalledWith(7, { status: 'AVAILABLE' }, m.TX);
  });

  it('start is rejected if the maintenance was cancelled in between', async () => {
    stateChangesConcurrently('PENDING', 'CANCELLED');

    await expect(maintenancesService.start(1, 99)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(m.maintenancesRepository.update).not.toHaveBeenCalled();
    expect(m.vehiclesRepository.update).not.toHaveBeenCalled();
  });

  it('complete is rejected if the maintenance was cancelled in between', async () => {
    stateChangesConcurrently('IN_PROGRESS', 'CANCELLED');

    await expect(maintenancesService.complete(1, 99)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(m.vehiclesRepository.update).not.toHaveBeenCalled();
  });

  it('start re-checks the vehicle under its lock (e.g. just assigned to a trip)', async () => {
    stateChangesConcurrently('PENDING', 'PENDING');
    m.vehiclesRepository.findById.mockResolvedValue({ id: 7, status: 'ON_TRIP' });

    await expect(maintenancesService.start(1, 99)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(m.maintenancesRepository.lockVehicle).toHaveBeenCalledWith(7, m.TX);
    expect(m.maintenancesRepository.update).not.toHaveBeenCalled();
  });
});
