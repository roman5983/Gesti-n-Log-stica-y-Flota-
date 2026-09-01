import { prisma } from '../../database/prisma-client';
import type { Prisma } from '../../generated/prisma/client';
import { utcStartOfToday } from '../../shared/utils/dates';
import type { DbClient } from '../audit-logs/audit-logs.repository';

/**
 * Driver aggregate = driver row + its user row (1:1, shared PK) + the
 * "has an active trip" flag needed to compute availability (RN-19).
 */
const driverInclude = {
  user: true,
  trips: { where: { status: 'IN_PROGRESS' as const }, select: { id: true }, take: 1 },
} satisfies Prisma.DriverInclude;

export type DriverWithUser = Prisma.DriverGetPayload<{ include: typeof driverInclude }>;

export interface DriverFilters {
  available?: boolean;
  search?: string;
}

interface PageArgs {
  skip: number;
  take: number;
}

function buildWhere(filters: DriverFilters): Prisma.DriverWhereInput {
  const where: Prisma.DriverWhereInput = {
    user: { deletedAt: null },
  };
  if (filters.search) {
    where.OR = [
      { dni: { contains: filters.search } },
      { user: { is: { name: { contains: filters.search }, deletedAt: null } } },
    ];
  }
  if (filters.available === true) {
    // RN-19: valid license + no active trip (+ active, non-deleted user).
    // A license expiring today is still valid today (RN-1).
    where.user = { is: { deletedAt: null, isActive: true } };
    where.licenseExpiryDate = { gte: utcStartOfToday() };
    where.trips = { none: { status: 'IN_PROGRESS' } };
  } else if (filters.available === false) {
    where.NOT = {
      user: { is: { deletedAt: null, isActive: true } },
      licenseExpiryDate: { gte: utcStartOfToday() },
      trips: { none: { status: 'IN_PROGRESS' } },
    };
  }
  return where;
}

export const driversRepository = {
  findById(userId: number, db: DbClient = prisma): Promise<DriverWithUser | null> {
    return db.driver.findFirst({
      where: { userId, user: { deletedAt: null } },
      include: driverInclude,
    });
  },

  findMany(filters: DriverFilters, page: PageArgs): Promise<DriverWithUser[]> {
    return prisma.driver.findMany({
      where: buildWhere(filters),
      include: driverInclude,
      orderBy: { userId: 'asc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: DriverFilters): Promise<number> {
    return prisma.driver.count({ where: buildWhere(filters) });
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
