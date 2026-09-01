import { prisma } from '../../database/prisma-client';
import type { MaintenanceType, Prisma } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

interface PageArgs {
  skip: number;
  take: number;
}

export const maintenanceTypesRepository = {
  findById(id: number, db: DbClient = prisma): Promise<MaintenanceType | null> {
    return db.maintenanceType.findUnique({ where: { id } });
  },

  findMany(page: PageArgs): Promise<MaintenanceType[]> {
    return prisma.maintenanceType.findMany({
      orderBy: { id: 'asc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(): Promise<number> {
    return prisma.maintenanceType.count();
  },

  async nameTaken(name: string, excludeId?: number): Promise<boolean> {
    const existing = await prisma.maintenanceType.findFirst({
      where: { name, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    return existing !== null;
  },

  /** A type referenced by at least one maintenance cannot be deleted. */
  async isInUse(id: number): Promise<boolean> {
    const maintenance = await prisma.maintenance.findFirst({
      where: { maintenanceTypeId: id },
      select: { id: true },
    });
    return maintenance !== null;
  },

  create(data: Prisma.MaintenanceTypeCreateInput, db: DbClient = prisma): Promise<MaintenanceType> {
    return db.maintenanceType.create({ data });
  },

  update(
    id: number,
    data: Prisma.MaintenanceTypeUpdateInput,
    db: DbClient = prisma,
  ): Promise<MaintenanceType> {
    return db.maintenanceType.update({ where: { id }, data });
  },

  delete(id: number, db: DbClient = prisma): Promise<MaintenanceType> {
    return db.maintenanceType.delete({ where: { id } });
  },
};
