import { prisma } from '../../database/prisma-client';
import type { Prisma, TripStatus } from '../../generated/prisma/client';
import { utcEndOfDay } from '../../shared/utils/dates';
import type { DbClient } from '../audit-logs/audit-logs.repository';

const tripInclude = {
  vehicle: { select: { id: true, licensePlate: true, model: true } },
  driver: { select: { userId: true, dni: true, user: { select: { name: true } } } },
  operator: { select: { id: true, name: true } },
} satisfies Prisma.TripInclude;

export type TripWithRelations = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

export interface TripFilters {
  status?: TripStatus;
  driverId?: number;
  vehicleId?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

interface PageArgs {
  skip: number;
  take: number;
}

function buildWhere(filters: TripFilters): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = {
    status: filters.status,
    driverId: filters.driverId,
    vehicleId: filters.vehicleId,
  };
  if (filters.dateFrom || filters.dateTo) {
    // utcEndOfDay makes dateTo an inclusive upper bound; a raw lte would drop
    // the last day of the range (timezone boundary, same fix as reports).
    where.departureAt = {
      ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
      ...(filters.dateTo ? { lte: utcEndOfDay(filters.dateTo) } : {}),
    };
  }
  return where;
}

export const tripsRepository = {
  findById(id: number, db: DbClient = prisma): Promise<TripWithRelations | null> {
    return db.trip.findUnique({ where: { id }, include: tripInclude });
  },

  findMany(filters: TripFilters, page: PageArgs): Promise<TripWithRelations[]> {
    return prisma.trip.findMany({
      where: buildWhere(filters),
      include: tripInclude,
      orderBy: { departureAt: 'desc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: TripFilters): Promise<number> {
    return prisma.trip.count({ where: buildWhere(filters) });
  },

  create(data: Prisma.TripUncheckedCreateInput, db: DbClient = prisma) {
    return db.trip.create({ data, include: tripInclude });
  },

  update(id: number, data: Prisma.TripUpdateInput, db: DbClient = prisma) {
    return db.trip.update({ where: { id }, data, include: tripInclude });
  },

  delete(id: number, db: DbClient = prisma) {
    return db.trip.delete({ where: { id } });
  },

  /** True if the driver has an active (IN_PROGRESS) trip — RN-19/RN-6. */
  async hasActiveTrip(driverId: number, db: DbClient = prisma): Promise<boolean> {
    const active = await db.trip.findFirst({
      where: { driverId, status: 'IN_PROGRESS' },
      select: { id: true },
    });
    return active !== null;
  },

  /**
   * Automatic vehicle selection (RN-12 / C-8): pick and row-lock the AVAILABLE
   * vehicle with the lowest accumulated km (efficiency criterion — spreads
   * usage across the fleet). FOR UPDATE SKIP LOCKED lets concurrent
   * assignments each grab a different vehicle instead of racing for one.
   * Returns the chosen vehicle id, or null if the fleet has none available.
   */
  async pickAvailableVehicle(tx: Prisma.TransactionClient): Promise<number | null> {
    // $queryRaw returns the id as a JS BigInt (e.g. 1n); typing it as bigint
    // (not number) keeps the type honest, and Number() converts it back so
    // downstream Prisma calls receive an Int, not a BigInt.
    const rows = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM vehicles
      WHERE status = 'AVAILABLE' AND deleted_at IS NULL
      ORDER BY accumulated_km ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    return rows[0] ? Number(rows[0].id) : null;
  },

  /** Row-lock the driver inside a transaction to serialize assignment. */
  async lockDriver(driverId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT user_id FROM drivers WHERE user_id = ${driverId} FOR UPDATE`;
  },

  /**
   * Row-lock the trip inside a transaction to serialize concurrent finishes
   * (driver and operator closing the same trip at once): without this, both
   * read IN_PROGRESS and apply the effects twice (double odometer write,
   * double increment of the driver's stats).
   */
  async lockTrip(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM trips WHERE id = ${id} FOR UPDATE`;
  },
};
