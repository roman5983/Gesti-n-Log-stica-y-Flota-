import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { usersApi } from '@/api/users.api';
import { EditProfileDialog } from './EditProfileDialog';

vi.mock('@/api/users.api', () => ({ usersApi: { update: vi.fn() } }));

const profile = {
  id: 1,
  name: 'Ana Admin',
  email: 'admin@empresa.com',
  role: 'ADMIN' as const,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  driver: null,
};

describe('EditProfileDialog — app validation instead of the browser bubble', () => {
  it('an invalid email is not sent: the app explains which field is wrong', async () => {
    render(<EditProfileDialog open profile={profile} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: 'no-es-un-mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect((await screen.findByRole('alert')).textContent).toBe('"Email" no tiene un formato válido.');
    expect(usersApi.update).not.toHaveBeenCalled();
  });
});
