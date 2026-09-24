import { prisma } from '../../database/prisma-client';
import type { Prisma, TripStatus } from '../../generated/prisma/client';
import { utcEndOfDay, utcStartOfToday } from '../../shared/utils/dates';
import { escapeLike } from '../../shared/utils/like';
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
  /** Substring of the driver's name or of the destination. */
  search?: string;
}

interface PageArgs {
  skip: number;
  take: number;
}

/** Exported for unit tests: the WHERE clause is where the filters combine. */
export function buildTripWhere(filters: TripFilters): Prisma.TripWhereInput {
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
  if (filters.search) {
    // One box, two fields: a trip matches if either contains the text. Trips
    // still pending assignment have no driver and can only match by destination.
    const term = escapeLike(filters.search);
    where.OR = [
      { destination: { contains: term } },
      { driver: { user: { name: { contains: term } } } },
    ];
  }
  return where;
}

export const tripsRepository = {
  findById(id: number, db: DbClient = prisma): Promise<TripWithRelations | null> {
    return db.trip.findUnique({ where: { id }, include: tripInclude });
  },

  findMany(filters: TripFilters, page: PageArgs): Promise<TripWithRelations[]> {
    return prisma.trip.findMany({
      where: buildTripWhere(filters),
      include: tripInclude,
      orderBy: { departureAt: 'desc' },
      skip: page.skip,
      take: page.take,
    });
  },

  count(filters: TripFilters): Promise<number> {
    return prisma.trip.count({ where: buildTripWhere(filters) });
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
   * Only vehicles with a current insurance (expiry date today or later; NULL
   * means none on record) are eligible — same criterion as `insuranceValid`.
   * Returns the chosen vehicle id, or null if none is eligible.
   */
  async pickAvailableVehicle(tx: Prisma.TransactionClient): Promise<number | null> {
    // $queryRaw returns the id as a JS BigInt (e.g. 1n); typing it as bigint
    // (not number) keeps the type honest, and Number() converts it back so
    // downstream Prisma calls receive an Int, not a BigInt.
    const rows = await tx.$queryRaw<{ id: bigint }[]>`
      SELECT id FROM vehicles
      WHERE status = 'AVAILABLE' AND deleted_at IS NULL
        AND insurance_expiry_date >= ${utcStartOfToday()}
      ORDER BY accumulated_km ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;
    return rows[0] ? Number(rows[0].id) : null;
  },

  /** Whether any AVAILABLE vehicle exists, insured or not (to explain a failed pick). */
  async hasAvailableVehicle(tx: Prisma.TransactionClient): Promise<boolean> {
    const found = await tx.vehicle.findFirst({
      where: { status: 'AVAILABLE', deletedAt: null },
      select: { id: true },
    });
    return found !== null;
  },

  /** Row-lock the driver inside a transaction to serialize assignment. */
  async lockDriver(driverId: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT user_id FROM drivers WHERE user_id = ${driverId} FOR UPDATE`;
  },

  /**
   * Row-lock the trip inside a transaction to serialize its state transitions
   * (assign / finish / cancel). Without it, two of them can both read the same
   * state and apply their effects — e.g. driver and operator finishing at once
   * (double odometer write, double stats increment), or an assignment
   * overwriting a cancel. Callers must re-read the trip after taking the lock.
   */
  async lockTrip(id: number, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM trips WHERE id = ${id} FOR UPDATE`;
  },
};
