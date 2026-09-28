import { prisma } from '../../database/prisma-client';
import type { DocumentType, Prisma } from '../../generated/prisma/client';
import { REQUIRED_DRIVER_DOCUMENT_TYPES } from '../../config/constants';
import { utcStartOfToday } from '../../shared/utils/dates';
import { escapeLike } from '../../shared/utils/like';
import type { DbClient } from '../audit-logs/audit-logs.repository';

/** RN-4: an active, unexpired document of the given type (expiring today still counts). */
function validDocumentOfType(documentType: DocumentType, today: Date): Prisma.DriverWhereInput {
  return { documents: { some: { documentType, deletedAt: null, expiryDate: { gte: today } } } };
}

/**
 * Driver aggregate = driver row + its user row (1:1, shared PK) + what's
 * needed to compute availability: the "has an active trip" flag (RN-19) and
 * which required documents are valid today (RN-4). A function, not a
 * constant, so "today" is computed on every query.
 */
function driverInclude() {
  return {
    user: true,
    trips: { where: { status: 'IN_PROGRESS' as const }, select: { id: true }, take: 1 },
    documents: {
      where: {
        deletedAt: null,
        documentType: { in: REQUIRED_DRIVER_DOCUMENT_TYPES },
        expiryDate: { gte: utcStartOfToday() },
      },
      select: { documentType: true },
    },
  } satisfies Prisma.DriverInclude;
}

export type DriverWithUser = Prisma.DriverGetPayload<{ include: ReturnType<typeof driverInclude> }>;

export interface DriverFilters {
  available?: boolean;
  search?: string;
}

interface PageArgs {
  skip: number;
  take: number;
}

export function buildDriverWhere(filters: DriverFilters): Prisma.DriverWhereInput {
  const where: Prisma.DriverWhereInput = {
    user: { deletedAt: null },
  };
  if (filters.search) {
    where.OR = [
      { dni: { contains: escapeLike(filters.search) } },
      { user: { is: { name: { contains: escapeLike(filters.search) }, deletedAt: null } } },
    ];
  }
  if (filters.available !== undefined) {
    // Assignable today: active, non-deleted user + valid license (RN-1: a
    // license expiring today is still valid) + no active trip (RN-19) +
    // complete, unexpired documentation (RN-4). Same criteria the trip
    // assignment enforces, so the assign dialog only offers drivers it accepts.
    const today = utcStartOfToday();
    const assignable: Prisma.DriverWhereInput = {
      user: { is: { deletedAt: null, isActive: true } },
      licenseExpiryDate: { gte: today },
      trips: { none: { status: 'IN_PROGRESS' } },
      AND: REQUIRED_DRIVER_DOCUMENT_TYPES.map((t) => validDocumentOfType(t, today)),
    };
    if (filters.available) Object.assign(where, assignable);
    else where.NOT = assignable;
  }
  return where;
}

export const driversRepository = {
  findById(userId: number, db: DbClient = prisma): Promise<DriverWithUser | null> {
    return db.driver.findFirst({
      where: { userId, user: { deletedAt: null } },
      include: driverInclude(),
    });
  },

  findMany(filters: DriverFilters, page: PageArgs): Promise<DriverWithUser[]> {
    return prisma.driver.findMany({
      where: buildDriverWhere(filters),
      include: driverInclude(),
      orderBy: { userId: 'asc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: DriverFilters): Promise<number> {
    return prisma.driver.count({ where: buildDriverWhere(filters) });
  },

  /** True if another driver (of a non-deleted user) already owns this DNI. */
  async dniTaken(dni: string, excludeUserId?: number): Promise<boolean> {
    const existing = await prisma.driver.findFirst({
      where: {
        dni,
        user: { deletedAt: null },
        ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
      },
      select: { userId: true },
    });
    return existing !== null;
  },

  create(data: Prisma.DriverUncheckedCreateInput, db: DbClient = prisma) {
    return db.driver.create({ data });
  },

  update(userId: number, data: Prisma.DriverUpdateInput, db: DbClient = prisma) {
    return db.driver.update({ where: { userId }, data });
  },
};
