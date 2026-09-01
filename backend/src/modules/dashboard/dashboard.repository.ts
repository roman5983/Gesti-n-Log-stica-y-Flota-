import { prisma } from '../../database/prisma-client';
import type { MaintenanceStatus, TripStatus, VehicleStatus } from '../../generated/prisma/client';

/**
 * Live dashboard aggregations (P-AD-1). Grouped counts come from Prisma
 * groupBy; the per-month trip series is reduced in the service from a bounded
 * window of completed trips.
 */
export const dashboardRepository = {
  fleetByStatus(): Promise<{ status: VehicleStatus; _count: number }[]> {
    return prisma.vehicle
      .groupBy({ by: ['status'], where: { deletedAt: null }, _count: true })
      .then((rows) => rows.map((r) => ({ status: r.status, _count: r._count })));
  },

  tripsByStatus(): Promise<{ status: TripStatus; _count: number }[]> {
    return prisma.trip
      .groupBy({ by: ['status'], _count: true })
      .then((rows) => rows.map((r) => ({ status: r.status, _count: r._count })));
  },

  maintenancesByStatus(): Promise<{ status: MaintenanceStatus; _count: number }[]> {
    return prisma.maintenance
      .groupBy({ by: ['status'], _count: true })
      .then((rows) => rows.map((r) => ({ status: r.status, _count: r._count })));
  },

  driversTotal(): Promise<number> {
    return prisma.driver.count({ where: { user: { deletedAt: null } } });
  },

  driversActive(): Promise<number> {
    return prisma.driver.count({ where: { user: { deletedAt: null, isActive: true } } });
  },

  usersTotal(): Promise<number> {
    return prisma.user.count({ where: { deletedAt: null } });
  },

  pendingAlerts(): Promise<number> {
    return prisma.alert.count({ where: { status: 'PENDING' } });
  },

  /** Completed trips finished on/after `since`, for the per-month series. */
  completedTripsSince(since: Date): Promise<{ finishedAt: Date | null }[]> {
    return prisma.trip.findMany({
      where: { status: 'COMPLETED', finishedAt: { gte: since } },
      select: { finishedAt: true },
    });
  },
};
