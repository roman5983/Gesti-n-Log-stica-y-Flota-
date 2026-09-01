import { prisma } from '../../database/prisma-client';
import type { Prisma } from '../../generated/prisma/client';

/**
 * Trips completed within the period, with the minimal relations the report
 * needs. "Completed within the period" is keyed on finishedAt (when the trip
 * was actually done), not departureAt. Per-trip km is derived
 * (arrivalKm - departureKm), so trips are aggregated in the service rather
 * than via groupBy, which cannot sum a computed expression.
 */
const reportTripInclude = {
  driver: { select: { userId: true, dni: true, user: { select: { name: true } } } },
  vehicle: { select: { id: true, licensePlate: true, model: true } },
} satisfies Prisma.TripInclude;

export type ReportTrip = Prisma.TripGetPayload<{ include: typeof reportTripInclude }>;

export const reportsRepository = {
  completedTrips(from: Date, to: Date): Promise<ReportTrip[]> {
    return prisma.trip.findMany({
      where: { status: 'COMPLETED', finishedAt: { gte: from, lte: to } },
      include: reportTripInclude,
      orderBy: { finishedAt: 'asc' },
    });
  },

  countMaintenancesCompleted(from: Date, to: Date): Promise<number> {
    return prisma.maintenance.count({
      where: { status: 'COMPLETED', completedAt: { gte: from, lte: to } },
    });
  },

  countAlertsRaised(from: Date, to: Date): Promise<number> {
    return prisma.alert.count({ where: { raisedAt: { gte: from, lte: to } } });
  },

  countAlertsResolved(from: Date, to: Date): Promise<number> {
    return prisma.alert.count({
      where: { status: 'RESOLVED', resolvedAt: { gte: from, lte: to } },
    });
  },
};
