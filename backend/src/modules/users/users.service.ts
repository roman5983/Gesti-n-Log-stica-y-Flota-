import bcrypt from 'bcryptjs';
import { prisma } from '../../database/prisma-client';
import type { Prisma, Role, User } from '../../generated/prisma/client';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { encrypt } from '../../shared/utils/crypto';
import { sendCredentialsEmail } from '../../shared/services/mailer';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { authRepository } from '../auth/auth.repository';
import { usersRepository, type UserFilters } from './users.repository';
import type { CreateUserDto, ListUsersQuery, UpdateUserDto } from './users.schemas';

const BCRYPT_ROUNDS = 10;

export interface UserResponse {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** API shape: never exposes passwordHash or soft-delete internals. */
function toResponse(user: User): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Snapshot for the audit trail (sensitive fields are redacted downstream). */
function toAuditSnapshot(user: User) {
  return { name: user.name, email: user.email, role: user.role, isActive: user.isActive };
}

async function getExistingOrFail(id: number): Promise<User> {
  const user = await usersRepository.findById(id);
  if (!user) throw new NotFoundError(`User ${id} not found`);
  return user;
}

/**
 * Last-admin rule: the system must always keep at least one usable
 * administrator (ADMIN, active, not deleted). Any operation that would take
 * the target out of that set — hard cases: soft-delete, deactivate, or
 * demote an admin — must first confirm another one remains.
 *
 * The check runs inside the caller's transaction and locks the admin rows
 * (lockActiveAdmins) so two admins acting in parallel can't both pass it.
 * No-op when the target isn't a currently-counted admin.
 */
async function assertNotRemovingLastAdmin(
  tx: Prisma.TransactionClient,
  target: User,
): Promise<void> {
  if (target.role !== 'ADMIN' || !target.isActive) return;

  await usersRepository.lockActiveAdmins(tx);
  const othersRemaining = await usersRepository.countActiveAdmins(target.id, tx);
  if (othersRemaining === 0) {
    throw new BusinessRuleError(
      'No se puede completar la acción porque es el único administrador activo del ' +
        'sistema. El sistema debe conservar al menos un administrador con acceso para ' +
        'poder gestionar usuarios, configuración y auditoría. Designá o activá a otro ' +
        'administrador antes de eliminar, desactivar o cambiar el rol de este.',
      'RN-ULTIMO-ADMIN',
    );
  }
}

/**
 * Message for a blocked self-action. When the actor is also the only usable
 * admin left, it appends the last-admin explanation — that's the usual way
 * an admin meets this rule from the UI (the one admin row is your own).
 */
async function selfActionBlockedMessage(actor: User, action: string): Promise<string> {
  let msg = `No podés ${action} tu propia cuenta.`;
  if (actor.role === 'ADMIN' && actor.isActive) {
    const others = await usersRepository.countActiveAdmins(actor.id);
    if (others === 0) {
      msg +=
        ' Además, sos el único administrador activo y el sistema no puede quedarse sin ' +
        'administradores: hace falta al menos uno con acceso para gestionar usuarios, ' +
        'configuración y auditoría. Creá o activá otro administrador primero.';
    }
  }
  return msg;
}

export const usersService = {
  async list(query: ListUsersQuery): Promise<PaginatedResult<UserResponse>> {
    const filters: UserFilters = {
      role: query.role,
      isActive: query.isActive,
      search: query.search,
    };
    const [users, total] = await Promise.all([
      usersRepository.findMany(filters, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      usersRepository.count(filters),
    ]);
    return { items: users.map(toResponse), total };
  },

  async getById(id: number): Promise<UserResponse> {
    return toResponse(await getExistingOrFail(id));
  },

  async create(dto: CreateUserDto, actorId: number): Promise<UserResponse> {
    if (await usersRepository.emailTaken(dto.email)) {
      throw new ConflictError(`Email ${dto.email} is already in use`);
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const created = await prisma.$transaction(async (tx) => {
      const user = await usersRepository.create(
        { name: dto.name, email: dto.email, passwordHash, role: dto.role },
        tx,
      );
      await auditLogsService.record(
        { actorId, action: 'CREATE', entity: 'USER', entityId: user.id, newData: toAuditSnapshot(user) },
        tx,
      );
      return user;
    });

    // Deliver credentials by email (DOC-1), after the commit and best-effort:
    // a mail failure must not undo the created user.
    await sendCredentialsEmail({
      to: created.email,
      name: created.name,
      email: created.email,
      password: dto.password,
    });
    return toResponse(created);
  },

  async update(id: number, dto: UpdateUserDto, actorId: number): Promise<UserResponse> {
    const existing = await getExistingOrFail(id);

    if (dto.email && dto.email !== existing.email) {
      if (await usersRepository.emailTaken(dto.email, id)) {
        throw new ConflictError(`Email ${dto.email} is already in use`);
      }
    }
    // A role change on a user with a driver profile would orphan its
    // driver data (DNI, license, documents) — structurally inconsistent.
    if (dto.role && dto.role !== existing.role && (await usersRepository.hasDriverProfile(id))) {
      throw new BusinessRuleError('Cannot change the role of a user with a driver profile');
    }
    // An admin demoting themselves would lock them out of user management.
    if (dto.role && dto.role !== existing.role && id === actorId) {
      throw new BusinessRuleError(
        await selfActionBlockedMessage(existing, 'cambiar el rol de'),
        'RN-ULTIMO-ADMIN',
      );
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      // Demoting the last admin would leave the system unmanageable.
      if (dto.role && dto.role !== existing.role) {
        await assertNotRemovingLastAdmin(tx, existing);
      }
      const user = await usersRepository.update(
        id,
        { name: dto.name, email: dto.email, role: dto.role, passwordHash },
        tx,
      );
      // A-9 consistency: if a driver's password changes, the AES copy
      // visible to the Admin must stay in sync with the bcrypt hash.
      if (dto.password && existing.role === 'DRIVER') {
        await tx.driver.update({
          where: { userId: id },
          data: { encryptedPassword: encrypt(dto.password) },
        });
      }
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'USER',
          entityId: id,
          previousData: toAuditSnapshot(existing),
          newData: { ...toAuditSnapshot(user), passwordChanged: Boolean(dto.password) },
        },
        tx,
      );
      return user;
    });
    // A changed password must invalidate existing sessions: whoever held
    // the old credentials keeps at most one short-lived access token.
    if (dto.password) await authRepository.revokeAllForUser(id);
    return toResponse(updated);
  },

  async setActive(id: number, isActive: boolean, actorId: number): Promise<UserResponse> {
    const existing = await getExistingOrFail(id);
    if (id === actorId) {
      throw new BusinessRuleError(
        await selfActionBlockedMessage(existing, 'activar o desactivar'),
        'RN-ULTIMO-ADMIN',
      );
    }
    if (existing.isActive === isActive) return toResponse(existing); // idempotent

    const updated = await prisma.$transaction(async (tx) => {
      // Deactivating the last admin would leave the system unmanageable.
      if (!isActive) await assertNotRemovingLastAdmin(tx, existing);
      const user = await usersRepository.update(id, { isActive }, tx);
      await auditLogsService.record(
        {
          actorId,
          action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
          entity: 'USER',
          entityId: id,
          previousData: { isActive: existing.isActive },
          newData: { isActive },
        },
        tx,
      );
      return user;
    });
    // A deactivated user must not keep working with live sessions.
    if (!isActive) await authRepository.revokeAllForUser(id);
    return toResponse(updated);
  },

  async softDelete(id: number, actorId: number): Promise<void> {
    const existing = await getExistingOrFail(id);
    // Deleting your own account is allowed, but only while the system keeps
    // another active admin (last-admin rule). The transaction re-checks this
    // under a lock; this early check just gives a clearer message up front.
    if (
      id === actorId &&
      existing.role === 'ADMIN' &&
      (await usersRepository.countActiveAdmins(actorId)) === 0
    ) {
      throw new BusinessRuleError(
        'No podés eliminar tu propia cuenta porque sos el único administrador ' +
          'activo: el sistema debe conservar al menos un administrador con acceso ' +
          'para gestionar usuarios, configuración y auditoría. Designá o activá a ' +
          'otro administrador y volvé a intentarlo.',
        'RN-ULTIMO-ADMIN',
      );
    }

    await prisma.$transaction(async (tx) => {
      // Deleting the last admin would leave the system unmanageable.
      await assertNotRemovingLastAdmin(tx, existing);
      await usersRepository.softDelete(id, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'DELETE',
          entity: 'USER',
          entityId: id,
          previousData: toAuditSnapshot(existing),
        },
        tx,
      );
    });
    await authRepository.revokeAllForUser(id);
  },
};
