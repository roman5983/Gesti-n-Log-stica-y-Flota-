import bcrypt from 'bcryptjs';
import { prisma } from '../../database/prisma-client';
import type { LicenseCategory } from '../../generated/prisma/client';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error';
import { decrypt, encrypt } from '../../shared/utils/crypto';
import { utcStartOfToday } from '../../shared/utils/dates';
import { sendCredentialsEmail } from '../../shared/services/mailer';
import type { PaginatedResult } from '../../shared/schemas';
import { auditLogsService } from '../audit-logs/audit-logs.service';
import { authRepository } from '../auth/auth.repository';
import { usersRepository } from '../users/users.repository';
import { driversRepository, type DriverWithUser, type DriverFilters } from './drivers.repository';
import type {
  ChangeDriverPasswordDto,
  CreateDriverDto,
  ListDriversQuery,
  UpdateDriverDto,
} from './drivers.schemas';

const BCRYPT_ROUNDS = 10;

export interface DriverResponse {
  id: number; // userId (shared PK)
  name: string;
  email: string;
  isActive: boolean;
  dni: string;
  licenseCategory: LicenseCategory;
  licenseExpiryDate: Date;
  /** License valid today (expiry >= today). */
  licenseValid: boolean;
  /** RN-19: active user + valid license + no active trip. */
  available: boolean;
  completedTrips: number;
  avgKm: number;
}

/** A license expiring today is still valid today (RN-1). */
function isLicenseValid(expiry: Date): boolean {
  return expiry >= utcStartOfToday();
}

function toResponse(driver: DriverWithUser): DriverResponse {
  const licenseValid = isLicenseValid(driver.licenseExpiryDate);
  const hasActiveTrip = driver.trips.length > 0;
  return {
    id: driver.userId,
    name: driver.user.name,
    email: driver.user.email,
    isActive: driver.user.isActive,
    dni: driver.dni,
    licenseCategory: driver.licenseCategory,
    licenseExpiryDate: driver.licenseExpiryDate,
    licenseValid,
    available: driver.user.isActive && licenseValid && !hasActiveTrip,
    completedTrips: driver.completedTrips,
    avgKm: Number(driver.avgKm),
  };
}

function toAuditSnapshot(driver: DriverWithUser) {
  return {
    name: driver.user.name,
    email: driver.user.email,
    dni: driver.dni,
    licenseCategory: driver.licenseCategory,
    licenseExpiryDate: driver.licenseExpiryDate,
  };
}

async function getExistingOrFail(id: number): Promise<DriverWithUser> {
  const driver = await driversRepository.findById(id);
  if (!driver) throw new NotFoundError(`Driver ${id} not found`);
  return driver;
}

export const driversService = {
  async list(query: ListDriversQuery): Promise<PaginatedResult<DriverResponse>> {
    const filters: DriverFilters = { available: query.available, search: query.search };
    const [drivers, total] = await Promise.all([
      driversRepository.findMany(filters, {
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      driversRepository.count(filters),
    ]);
    return { items: drivers.map(toResponse), total };
  },

  async getById(id: number): Promise<DriverResponse> {
    return toResponse(await getExistingOrFail(id));
  },

  /** Atomic creation: user (role DRIVER) + driver profile in one transaction. */
  async create(dto: CreateDriverDto, actorId: number): Promise<DriverResponse> {
    if (await usersRepository.emailTaken(dto.email)) {
      throw new ConflictError(`Email ${dto.email} is already in use`);
    }
    if (await driversRepository.dniTaken(dto.dni)) {
      throw new ConflictError(`DNI ${dto.dni} is already registered`);
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const createdId = await prisma.$transaction(async (tx) => {
      const user = await usersRepository.create(
        { name: dto.name, email: dto.email, passwordHash, role: 'DRIVER' },
        tx,
      );
      await driversRepository.create(
        {
          userId: user.id,
          dni: dto.dni,
          licenseCategory: dto.licenseCategory,
          licenseExpiryDate: dto.licenseExpiryDate,
          encryptedPassword: encrypt(dto.password), // A-9: Admin-visible copy
        },
        tx,
      );
      await auditLogsService.record(
        {
          actorId,
          action: 'CREATE',
          entity: 'DRIVER',
          entityId: user.id,
          newData: { name: dto.name, email: dto.email, dni: dto.dni },
        },
        tx,
      );
      return user.id;
    });

    // Deliver credentials by email (DOC-1), best-effort after the commit.
    await sendCredentialsEmail({
      to: dto.email,
      name: dto.name,
      email: dto.email,
      password: dto.password,
    });
    return toResponse((await driversRepository.findById(createdId))!);
  },

  async update(id: number, dto: UpdateDriverDto, actorId: number): Promise<DriverResponse> {
    const existing = await getExistingOrFail(id);

    if (dto.email && dto.email !== existing.user.email) {
      if (await usersRepository.emailTaken(dto.email, id)) {
        throw new ConflictError(`Email ${dto.email} is already in use`);
      }
    }
    if (dto.dni && dto.dni !== existing.dni) {
      if (await driversRepository.dniTaken(dto.dni, id)) {
        throw new ConflictError(`DNI ${dto.dni} is already registered`);
      }
    }

    await prisma.$transaction(async (tx) => {
      if (dto.name || dto.email) {
        await usersRepository.update(id, { name: dto.name, email: dto.email }, tx);
      }
      if (dto.dni || dto.licenseCategory || dto.licenseExpiryDate) {
        await driversRepository.update(
          id,
          {
            dni: dto.dni,
            licenseCategory: dto.licenseCategory,
            licenseExpiryDate: dto.licenseExpiryDate,
          },
          tx,
        );
      }
      const updated = await driversRepository.findById(id, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'DRIVER',
          entityId: id,
          previousData: toAuditSnapshot(existing),
          newData: toAuditSnapshot(updated!),
        },
        tx,
      );
    });

    return toResponse((await driversRepository.findById(id))!);
  },

  /**
   * A-9: the Admin can VIEW a driver's password (decrypted from the AES copy).
   * Security-sensitive read → it leaves an audit trail (VIEW_CREDENTIALS).
   */
  async getPassword(id: number, actorId: number): Promise<{ password: string }> {
    const driver = await getExistingOrFail(id);
    await auditLogsService.record({
      actorId,
      action: 'VIEW_CREDENTIALS',
      entity: 'DRIVER',
      entityId: id,
    });
    return { password: decrypt(driver.encryptedPassword) };
  },

  /**
   * A-9/F-4: the Admin changes a driver's password from the driver screen.
   * bcrypt hash and AES copy are updated in the same transaction; existing
   * sessions of the driver are revoked.
   */
  async changePassword(id: number, dto: ChangeDriverPasswordDto, actorId: number): Promise<void> {
    await getExistingOrFail(id);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    await prisma.$transaction(async (tx) => {
      await usersRepository.update(id, { passwordHash }, tx);
      await driversRepository.update(id, { encryptedPassword: encrypt(dto.password) }, tx);
      await auditLogsService.record(
        {
          actorId,
          action: 'UPDATE',
          entity: 'DRIVER',
          entityId: id,
          newData: { passwordChanged: true },
        },
        tx,
      );
    });
    await authRepository.revokeAllForUser(id);
  },
};
