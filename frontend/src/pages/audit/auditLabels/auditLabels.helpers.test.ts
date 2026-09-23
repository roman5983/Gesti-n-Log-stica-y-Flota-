import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  entityLabel,
  entityWithId,
  fieldLabel,
  formatAuditValue,
} from './auditLabels.helpers';

describe('auditLabels', () => {
  it('translates actions and entities to Spanish', () => {
    expect(actionLabel('VIEW_CREDENTIALS')).toBe('Consulta de credenciales');
    expect(actionLabel('UPDATE')).toBe('Modificación');
    expect(entityLabel('COMPANY_SETTINGS')).toBe('Configuración de la empresa');
    expect(entityWithId('VEHICLE', 12)).toBe('Vehículo #12');
    expect(entityWithId('ALERT', null)).toBe('Alerta');
  });

  it('lets unknown codes through instead of hiding them', () => {
    expect(actionLabel('FUTURE_ACTION')).toBe('FUTURE_ACTION');
    expect(fieldLabel('campoNuevo')).toBe('campoNuevo');
  });

  it('translates technical field names', () => {
    expect(fieldLabel('licensePlate')).toBe('Patente');
    expect(fieldLabel('isActive')).toBe('Activo');
  });

  it('formats booleans as Sí/No', () => {
    expect(formatAuditValue('isActive', true, 'USER')).toBe('Sí');
    expect(formatAuditValue('isActive', false, 'USER')).toBe('No');
  });

  it('shows a dash when there is no value', () => {
    expect(formatAuditValue('model', null, 'VEHICLE')).toBe('—');
    expect(formatAuditValue('model', undefined, 'VEHICLE')).toBe('—');
  });

  it('never leaks a field redacted by the backend', () => {
    expect(formatAuditValue('passwordHash', '[REDACTED]', 'USER')).toBe('Oculto por seguridad');
  });

  it('resolves shared status codes by entity', () => {
    // IN_PROGRESS y COMPLETED significan cosas distintas en viajes y mantenimientos.
    expect(formatAuditValue('status', 'IN_PROGRESS', 'TRIP')).toBe('En viaje');
    expect(formatAuditValue('status', 'IN_PROGRESS', 'MAINTENANCE')).toBe('En curso');
    expect(formatAuditValue('status', 'COMPLETED', 'TRIP')).toBe('Finalizado');
    expect(formatAuditValue('status', 'COMPLETED', 'MAINTENANCE')).toBe('Completado');
  });

  it('translates shared statuses and roles', () => {
    expect(formatAuditValue('status', 'ON_TRIP', 'VEHICLE')).toBe('En viaje');
    expect(formatAuditValue('role', 'ADMIN', 'USER')).toBe('Administrador');
    expect(formatAuditValue('documentType', 'PSYCHOPHYSICAL', 'DRIVER_DOCUMENT')).toBe('Psicofísico');
  });

  it('reads expiry dates in UTC so no day is lost', () => {
    // @db.Date columns: Prisma serializes them as UTC midnight. Reading them in
    // local time (UTC-3) would show the 14th instead of the 15th.
    expect(formatAuditValue('licenseExpiryDate', '2026-03-15T00:00:00.000Z', 'DRIVER')).toBe(
      '15/3/2026',
    );
  });

  it('formats kilometers and ids', () => {
    expect(formatAuditValue('accumulatedKm', 125000, 'VEHICLE')).toBe('125.000 km');
    expect(formatAuditValue('driverId', 7, 'TRIP')).toBe('#7');
    expect(formatAuditValue('year', 2019, 'VEHICLE')).toBe('2019');
  });
});
