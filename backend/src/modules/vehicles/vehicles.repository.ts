import { prisma } from '../../database/prisma-client';
import type { Prisma, Vehicle, VehicleStatus } from '../../generated/prisma/client';
import type { DbClient } from '../audit-logs/audit-logs.repository';

export interface VehicleFilters {
  status?: VehicleStatus;
  search?: string;
}

interface PageArgs {
  skip: number;
  take: number;
}

/** Soft-delete convention (RN-20): every read filters deletedAt = null. */
function buildWhere(filters: VehicleFilters): Prisma.VehicleWhereInput {
  return {
    deletedAt: null,
    status: filters.status,
    ...(filters.search
      ? {
          OR: [
            { licensePlate: { contains: filters.search } },
            { model: { contains: filters.search } },
          ],
        }
      : {}),
  };
}

export const vehiclesRepository = {
  findById(id: number, db: DbClient = prisma): Promise<Vehicle | null> {
    return db.vehicle.findFirst({ where: { id, deletedAt: null } });
  },

  findMany(filters: VehicleFilters, page: PageArgs): Promise<Vehicle[]> {
    return prisma.vehicle.findMany({
      where: buildWhere(filters),
      orderBy: { id: 'asc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: VehicleFilters): Promise<number> {
    return prisma.vehicle.count({ where: buildWhere(filters) });
  },

  /** True if another non-deleted vehicle already owns this plate. */
  async plateTaken(licensePlate: string, excludeId?: number): Promise<boolean> {
    const existing = await prisma.vehicle.findFirst({
      where: {
        licensePlate,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return existing !== null;
  },

  /** A vehicle with trips or maintenances has history — some edits are blocked. */
  async hasHistory(id: number): Promise<boolean> {
    const [trip, maintenance] = await Promise.all([
      prisma.trip.findFirst({ where: { vehicleId: id }, select: { id: true } }),
      prisma.maintenance.findFirst({ where: { vehicleId: id }, select: { id: true } }),
    ]);
    return trip !== null || maintenance !== null;
  },

  create(data: Prisma.VehicleCreateInput, db: DbClient = prisma): Promise<Vehicle> {
    return db.vehicle.create({ data });
  },

  update(id: number, data: Prisma.VehicleUpdateInput, db: DbClient = prisma): Promise<Vehicle> {
    return db.vehicle.update({ where: { id }, data });
  },

  /**
   * Soft delete with license-plate tombstone: UNIQUE(license_plate) also
   * covers soft-deleted rows (same pattern as users.email — Entry 6 of the
   * dev log). `DEL-{id}` is short, collision-free and fits VARCHAR(10).
   */
  softDelete(id: number, db: DbClient = prisma): Promise<Vehicle> {
    return db.vehicle.update({
      where: { id },
      data: { deletedAt: new Date(), licensePlate: `DEL-${id}` },
    });
  },
};
