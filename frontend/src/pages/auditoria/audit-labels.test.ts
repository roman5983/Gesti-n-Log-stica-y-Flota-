import { describe, expect, it } from 'vitest';
import {
  actionLabel,
  entityLabel,
  entityWithId,
  fieldLabel,
  formatAuditValue,
} from './audit-labels';

describe('audit-labels', () => {
  it('traduce acciones y entidades al castellano', () => {
    expect(actionLabel('VIEW_CREDENTIALS')).toBe('Consulta de credenciales');
    expect(actionLabel('UPDATE')).toBe('Modificación');
    expect(entityLabel('COMPANY_SETTINGS')).toBe('Configuración de la empresa');
    expect(entityWithId('VEHICLE', 12)).toBe('Vehículo #12');
    expect(entityWithId('ALERT', null)).toBe('Alerta');
  });

  it('deja pasar códigos desconocidos en vez de ocultarlos', () => {
    expect(actionLabel('FUTURE_ACTION')).toBe('FUTURE_ACTION');
    expect(fieldLabel('campoNuevo')).toBe('campoNuevo');
  });

  it('traduce nombres de campo técnicos', () => {
    expect(fieldLabel('licensePlate')).toBe('Patente');
    expect(fieldLabel('isActive')).toBe('Activo');
  });

  it('formatea booleanos como Sí/No', () => {
    expect(formatAuditValue('isActive', true, 'USER')).toBe('Sí');
    expect(formatAuditValue('isActive', false, 'USER')).toBe('No');
  });

  it('muestra un guion cuando no hay valor', () => {
    expect(formatAuditValue('model', null, 'VEHICLE')).toBe('—');
    expect(formatAuditValue('model', undefined, 'VEHICLE')).toBe('—');
  });

  it('nunca filtra un campo redactado por el backend', () => {
    expect(formatAuditValue('passwordHash', '[REDACTED]', 'USER')).toBe('Oculto por seguridad');
  });

  it('resuelve los estados repetidos según la entidad', () => {
    // IN_PROGRESS y COMPLETED significan cosas distintas en viajes y mantenimientos.
    expect(formatAuditValue('status', 'IN_PROGRESS', 'TRIP')).toBe('En viaje');
    expect(formatAuditValue('status', 'IN_PROGRESS', 'MAINTENANCE')).toBe('En curso');
    expect(formatAuditValue('status', 'COMPLETED', 'TRIP')).toBe('Finalizado');
    expect(formatAuditValue('status', 'COMPLETED', 'MAINTENANCE')).toBe('Completado');
  });

  it('traduce estados y roles compartidos', () => {
    expect(formatAuditValue('status', 'ON_TRIP', 'VEHICLE')).toBe('En viaje');
    expect(formatAuditValue('role', 'ADMIN', 'USER')).toBe('Administrador');
    expect(formatAuditValue('documentType', 'PSYCHOPHYSICAL', 'DRIVER_DOCUMENT')).toBe('Psicofísico');
  });

  it('lee las fechas de vencimiento en UTC para no perder un día', () => {
    // Columnas @db.Date: Prisma las serializa como medianoche UTC. Leerlas en
    // hora local (UTC-3) mostraría el 14 en vez del 15.
    expect(formatAuditValue('licenseExpiryDate', '2026-03-15T00:00:00.000Z', 'DRIVER')).toBe(
      '15/3/2026',
    );
  });

  it('formatea kilómetros e identificadores', () => {
    expect(formatAuditValue('accumulatedKm', 125000, 'VEHICLE')).toBe('125.000 km');
    expect(formatAuditValue('driverId', 7, 'TRIP')).toBe('#7');
    expect(formatAuditValue('year', 2019, 'VEHICLE')).toBe('2019');
  });
});
