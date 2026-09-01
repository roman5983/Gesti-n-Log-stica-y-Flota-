import { prisma } from '../../database/prisma-client';
import type { Prisma, Role, User } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

export interface UserFilters {
  /** One or more roles; matched with an IN clause. */
  role?: Role[];
  isActive?: boolean;
  search?: string;
}

interface PageArgs {
  skip: number;
  take: number;
}

/** Soft-delete convention (RN-20): every read filters deletedAt = null. */
function buildWhere(filters: UserFilters): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    role: filters.role ? { in: filters.role } : undefined,
    isActive: filters.isActive,
    ...(filters.search
      ? {
          OR: [{ name: { contains: filters.search } }, { email: { contains: filters.search } }],
        }
      : {}),
  };
}

export const usersRepository = {
  findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email, deletedAt: null } });
  },

  findById(id: number, db: DbClient = prisma): Promise<User | null> {
    return db.user.findFirst({ where: { id, deletedAt: null } });
  },

  findMany(filters: UserFilters, page: PageArgs): Promise<User[]> {
    return prisma.user.findMany({
      where: buildWhere(filters),
      orderBy: { id: 'asc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: UserFilters): Promise<number> {
    return prisma.user.count({ where: buildWhere(filters) });
  },

  /** True if another non-deleted user already owns this email. */
  async emailTaken(email: string, excludeId?: number): Promise<boolean> {
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return existing !== null;
  },

  create(data: Prisma.UserCreateInput, db: DbClient = prisma): Promise<User> {
    return db.user.create({ data });
  },

  update(id: number, data: Prisma.UserUpdateInput, db: DbClient = prisma): Promise<User> {
    return db.user.update({ where: { id }, data });
  },

  /**
   * Soft delete with email tombstone: the DB-level UNIQUE(email) also covers
   * soft-deleted rows, so the email is replaced with a short, collision-free
   * placeholder (one row per id) to free it for future users. The original
   * email is preserved in the audit trail (previousData).
   */
  softDelete(id: number, db: DbClient = prisma): Promise<User> {
    return db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        email: `deleted-${id}@deleted.local`,
      },
    });
  },

  /** Whether the user has a driver row (blocks role changes — see service). */
  async hasDriverProfile(id: number): Promise<boolean> {
    const driver = await prisma.driver.findUnique({
      where: { userId: id },
      select: { userId: true },
    });
    return driver !== null;
  },
};
