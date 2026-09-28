import { beforeEach, describe, expect, it, vi } from 'vitest';
import { vehiclesService } from './vehicles.service';
import { BusinessRuleError } from '../../shared/errors/app-error';

/**
 * Deactivating or deleting a vehicle decides from the copy read UNDER the
 * vehicle row lock. The race is simulated by making the read before the
 * transaction (AVAILABLE) disagree with the locked one (ON_TRIP): what happens
 * when a trip assignment commits in between.
 */

const m = vi.hoisted(() => {
  const TX = { __tx: true };
  return {
    TX,
    vehiclesRepository: {
      findById: vi.fn(),
      lockAndReload: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
    maintenancesRepository: { hasOpenForVehicle: vi.fn() },
    record: vi.fn(),
  };
});

vi.mock('../../database/prisma-client', () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.TX) },
}));
vi.mock('./vehicles.repository', () => ({ vehiclesRepository: m.vehiclesRepository }));
vi.mock('../maintenances/maintenances.repository', () => ({ maintenancesRepository: m.maintenancesRepository }));
vi.mock('../audit-logs/audit-logs.service', () => ({ auditLogsService: { record: m.record } }));

function vehicle(status: string) {
  return {
    id: 7,
    licensePlate: 'AB123CD',
    model: 'Iveco Daily',
    year: 2021,
    initialKm: 1000,
    accumulatedKm: 52000,
    lastMaintenanceDate: null,
    insuranceExpiryDate: null,
    status,
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.vehiclesRepository.findById.mockResolvedValue(vehicle('AVAILABLE'));
  m.maintenancesRepository.hasOpenForVehicle.mockResolvedValue(false);
  m.vehiclesRepository.update.mockResolvedValue(vehicle('INACTIVE'));
});

describe('vehiclesService — deactivation/deletion under the vehicle lock', () => {
  it('refuses to deactivate when the vehicle went on a trip in the meantime', async () => {
    m.vehiclesRepository.lockAndReload.mockResolvedValue(vehicle('ON_TRIP'));

    await expect(vehiclesService.deactivate(7, 1)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(m.vehiclesRepository.lockAndReload).toHaveBeenCalledWith(7, m.TX);
    expect(m.vehiclesRepository.update).not.toHaveBeenCalled();
  });

  it('deactivates an available vehicle and audits the status read under the lock', async () => {
    m.vehiclesRepository.lockAndReload.mockResolvedValue(vehicle('AVAILABLE'));

    const result = await vehiclesService.deactivate(7, 1);

    expect(result.status).toBe('INACTIVE');
    expect(m.vehiclesRepository.update).toHaveBeenCalledWith(7, { status: 'INACTIVE' }, m.TX);
    expect(m.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DEACTIVATE', previousData: { status: 'AVAILABLE' } }),
      m.TX,
    );
  });

  it('refuses to delete when the vehicle went on a trip in the meantime', async () => {
    m.vehiclesRepository.lockAndReload.mockResolvedValue(vehicle('ON_TRIP'));

    await expect(vehiclesService.softDelete(7, 1)).rejects.toBeInstanceOf(BusinessRuleError);
    expect(m.vehiclesRepository.softDelete).not.toHaveBeenCalled();
  });

  it('checks open maintenances inside the transaction before deleting', async () => {
    m.vehiclesRepository.lockAndReload.mockResolvedValue(vehicle('AVAILABLE'));
    m.maintenancesRepository.hasOpenForVehicle.mockResolvedValue(true);

    await expect(vehiclesService.softDelete(7, 1)).rejects.toThrow('mantenimiento abierto');
    expect(m.maintenancesRepository.hasOpenForVehicle).toHaveBeenCalledWith(7, undefined, m.TX);
    expect(m.vehiclesRepository.softDelete).not.toHaveBeenCalled();
  });
});
