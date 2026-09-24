import { describe, expect, it } from 'vitest';
import type { Alert } from '@/api/alerts.api';
import { sourceLink } from './AlertsPage.helpers';

const base: Alert = {
  id: 1,
  alertType: 'X',
  description: '',
  entityType: 'VEHICLE',
  entityId: 7,
  status: 'PENDING',
  raisedAt: '2026-09-24T09:00:00.000Z',
  resolvedById: null,
  resolvedAt: null,
};

describe('sourceLink ("ir al origen")', () => {
  it('points each entity to the screen that manages it', () => {
    expect(sourceLink(base)).toBe('/vehiculos?highlight=7');
    expect(sourceLink({ ...base, entityType: 'DRIVER', entityId: 3 })).toBe('/choferes?highlight=3');
    expect(sourceLink({ ...base, entityType: 'TRIP', entityId: 41 })).toBe('/viajes?highlight=41');
  });

  it('opens the documents of the owning driver for document alerts', () => {
    expect(sourceLink({ ...base, entityType: 'DRIVER_DOCUMENT', entityId: 9, linkedDriverId: 3 })).toBe(
      '/choferes?highlight=3&open=docs',
    );
    expect(sourceLink({ ...base, entityType: 'DRIVER_DOCUMENT', entityId: 9 })).toBeNull();
  });

  it('has no link for an unknown entity', () => {
    expect(sourceLink({ ...base, entityType: 'SOMETHING' })).toBeNull();
  });
});
