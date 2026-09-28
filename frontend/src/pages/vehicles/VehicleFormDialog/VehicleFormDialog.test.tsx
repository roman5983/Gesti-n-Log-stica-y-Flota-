import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { AppLocalizationProvider } from '@/components/AppLocalizationProvider/AppLocalizationProvider';
import { vehiclesApi } from '@/api/vehicles.api';
import { VehicleFormDialog } from './VehicleFormDialog';

vi.mock('@/api/vehicles.api', () => ({ vehiclesApi: { create: vi.fn(), update: vi.fn() } }));

describe('VehicleFormDialog — app validation instead of the browser bubble', () => {
  it('an empty form is not sent: the app says which field is missing', async () => {
    render(
      <AppLocalizationProvider>
        <VehicleFormDialog open vehicle={null} onClose={() => {}} onSaved={() => {}} />
      </AppLocalizationProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Completá el campo "Patente".');
    expect(vehiclesApi.create).not.toHaveBeenCalled();
  });
});
