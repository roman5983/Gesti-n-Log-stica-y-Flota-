import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usersService } from './users.service';
import { BusinessRuleError } from '../../shared/errors/app-error';

/**
 * A driver on a trip in progress can be neither deactivated nor deleted, and
 * the check runs under the driver row lock that trip assignment takes (so an
 * assignment committing at the same time cannot slip through).
 */

const m = vi.hoisted(() => {
  const TX = { __tx: true };
  const order: string[] = [];
  return {
    TX,
    order,
    usersRepository: {
      findById: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
      lockAndCountOtherActiveAdmins: vi.fn(),
      countActiveAdmins: vi.fn(),
    },
    tripsRepository: {
      lockDriver: vi.fn(async () => {
        order.push('lockDriver');
      }),
      hasActiveTrip: vi.fn(async () => {
        order.push('hasActiveTrip');
        return false;
      }),
    },
    revokeAllForUser: vi.fn(),
    record: vi.fn(),
  };
});

vi.mock('../../database/prisma-client', () => ({
  prisma: { $transaction: (fn: (tx: unknown) => unknown) => fn(m.TX) },
}));
vi.mock('./users.repository', () => ({ usersRepository: m.usersRepository }));
vi.mock('../trips/trips.repository', () => ({ tripsRepository: m.tripsRepository }));
vi.mock('../auth/auth.repository', () => ({ authRepository: { revokeAllForUser: m.revokeAllForUser } }));
vi.mock('../audit-logs/audit-logs.service', () => ({ auditLogsService: { record: m.record } }));
vi.mock('../../shared/services/mailer', () => ({ sendCredentialsEmail: vi.fn() }));

function user(role: 'ADMIN' | 'OPERATOR' | 'DRIVER', id = 5) {
  return {
    id,
    name: 'Juan',
    email: 'juan@empresa.com',
    role,
    isActive: true,
    passwordHash: 'x',
    deletedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  m.order.length = 0;
  m.usersRepository.update.mockImplementation(async () => ({ ...user('DRIVER'), isActive: false }));
});

describe('usersService — a driver on a trip cannot leave', () => {
  it('refuses to delete a driver with a trip in progress (checked under the driver lock)', async () => {
    m.usersRepository.findById.mockResolvedValue(user('DRIVER'));
    m.tripsRepository.hasActiveTrip.mockImplementationOnce(async () => {
      m.order.push('hasActiveTrip');
      return true;
    });

    await expect(usersService.softDelete(5, 1)).rejects.toThrow(
      new BusinessRuleError('No se puede eliminar a un chofer con un viaje en curso'),
    );
    expect(m.order).toEqual(['lockDriver', 'hasActiveTrip']);
    expect(m.tripsRepository.hasActiveTrip).toHaveBeenCalledWith(5, m.TX);
    expect(m.usersRepository.softDelete).not.toHaveBeenCalled();
  });

  it('refuses to deactivate a driver with a trip in progress', async () => {
    m.usersRepository.findById.mockResolvedValue(user('DRIVER'));
    m.tripsRepository.hasActiveTrip.mockResolvedValueOnce(true);

    await expect(usersService.setActive(5, false, 1)).rejects.toThrow(
      'No se puede dar de baja a un chofer con un viaje en curso',
    );
    expect(m.usersRepository.update).not.toHaveBeenCalled();
  });

  it('deletes a driver without an active trip', async () => {
    m.usersRepository.findById.mockResolvedValue(user('DRIVER'));

    await usersService.softDelete(5, 1);

    expect(m.order).toEqual(['lockDriver', 'hasActiveTrip']);
    expect(m.usersRepository.softDelete).toHaveBeenCalledWith(5, m.TX);
    expect(m.revokeAllForUser).toHaveBeenCalledWith(5);
  });

  it('does not lock or check trips for other roles', async () => {
    m.usersRepository.findById.mockResolvedValue(user('OPERATOR'));

    await usersService.softDelete(5, 1);

    expect(m.tripsRepository.lockDriver).not.toHaveBeenCalled();
    expect(m.usersRepository.softDelete).toHaveBeenCalled();
  });
});
