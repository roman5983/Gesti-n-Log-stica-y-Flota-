import { describe, expect, it } from 'vitest';
import type { Driver } from '@/api/drivers.api';
import { unavailabilityReasons } from './DriversPage.helpers';

const base: Driver = {
  id: 3,
  name: 'Juan Pérez',
  email: 'chofer@empresa.com',
  isActive: true,
  dni: '30111222',
  licenseCategory: 'C',
  licenseExpiryDate: '2027-05-01T00:00:00.000Z',
  licenseValid: true,
  documentsComplete: true,
  available: true,
  completedTrips: 0,
  avgKm: 0,
};

describe('unavailabilityReasons ("Disponible" tooltip)', () => {
  it('is empty for an available driver', () => {
    expect(unavailabilityReasons(base)).toEqual([]);
  });

  it('lists every failing condition', () => {
    expect(
      unavailabilityReasons({ ...base, available: false, licenseValid: false, documentsComplete: false }),
    ).toEqual(['Licencia vencida', 'Documentación incompleta o vencida']);
  });

  it('when everything else holds, the reason is a trip in progress', () => {
    expect(unavailabilityReasons({ ...base, available: false })).toEqual(['Tiene un viaje en curso']);
  });
});
