import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AuditLogDetailDialog } from './AuditLogDetailDialog';
import type { AuditLog } from '../../api/audit-logs.api';

/** Component test for the audit detail dialog: the diff is the whole point of
 *  the screen, so it is verified against a realistic UPDATE snapshot. */

const baseLog: AuditLog = {
  id: '1',
  user: { id: 1, name: 'Roman', email: 'admin@empresa.com' },
  action: 'UPDATE',
  entity: 'VEHICLE',
  entityId: 12,
  occurredAt: '2026-09-14T15:30:00.000Z',
  previousData: { licensePlate: 'AB123CD', status: 'AVAILABLE', accumulatedKm: 120000 },
  newData: { licensePlate: 'AB123CD', status: 'IN_WORKSHOP', accumulatedKm: 125000 },
};

function renderDialog(log: AuditLog) {
  return render(<AuditLogDetailDialog log={log} onClose={() => {}} />);
}

describe('AuditLogDetailDialog', () => {
  it('muestra la acción y la entidad traducidas', () => {
    renderDialog(baseLog);
    expect(screen.getByText('Modificación')).toBeTruthy();
    expect(screen.getByText('Vehículo #12')).toBeTruthy();
  });

  it('cuenta y lista solo los campos que cambiaron', () => {
    renderDialog(baseLog);
    // Cambiaron estado y km; la patente quedó igual.
    expect(screen.getByText('2 campos modificados')).toBeTruthy();
    expect(screen.getByText('Estado')).toBeTruthy();
    expect(screen.getByText('Km acumulado')).toBeTruthy();
    expect(screen.queryByText('Patente')).toBeNull();
  });

  it('muestra el antes y el después ya formateados', () => {
    renderDialog(baseLog);
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByText('En taller')).toBeTruthy();
    expect(screen.getByText('120.000 km')).toBeTruthy();
    expect(screen.getByText('125.000 km')).toBeTruthy();
  });

  it('esconde los campos sin cambios hasta que se los despliega', () => {
    renderDialog(baseLog);
    const toggle = screen.getByText('1 campo sin cambios');
    expect(screen.queryByText('Patente')).toBeNull();

    fireEvent.click(toggle);

    expect(screen.getByText('Patente')).toBeTruthy();
    expect(screen.getByText('AB123CD')).toBeTruthy();
  });

  it('presenta un alta como datos registrados, sin comparación', () => {
    renderDialog({
      ...baseLog,
      action: 'CREATE',
      previousData: null,
      newData: { licensePlate: 'XY999ZZ', status: 'AVAILABLE' },
    });
    expect(screen.getByText('Datos registrados')).toBeTruthy();
    expect(screen.queryByText(/campos modificados/)).toBeNull();
  });

  it('explica las acciones que no registran datos', () => {
    renderDialog({
      ...baseLog,
      action: 'VIEW_CREDENTIALS',
      entity: 'DRIVER',
      previousData: null,
      newData: null,
    });
    expect(screen.getByText('Consulta de credenciales')).toBeTruthy();
    expect(screen.getByText(/no registra cambios de datos/)).toBeTruthy();
  });
});
