import type {
  MaintenanceStatus,
  TripStatus,
  VehicleStatus,
} from '../../generated/prisma/client';
import { dashboardRepository } from './dashboard.repository';

export interface DashboardMetrics {
  fleet: {
    total: number;
    available: number;
    inWorkshop: number;
    onTrip: number;
    inactive: number;
  };
  trips: { inProgress: number; pendingAssignment: number; completed: number };
  drivers: { total: number; active: number };
  maintenances: { pending: number }; // scheduled = PENDING + IN_PROGRESS (C-6)
  alerts: { pending: number };
  users: { total: number };
  tripsPerMonth: { month: string; count: number }[]; // last 6 months
}

const MONTHS_WINDOW = 6;

function countBy<T extends string>(rows: { status: T; _count: number }[], status: T): number {
  return rows.find((r) => r.status === status)?._count ?? 0;
}

/** First day (UTC) of the month, `monthsBack` months before the current one. */
function startOfMonthUtc(monthsBack: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsBack, 1));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const dashboardService = {
  async metrics(): Promise<DashboardMetrics> {
    const since = startOfMonthUtc(MONTHS_WINDOW - 1);
    const [fleet, trips, maint, driversTotal, driversActive, usersTotal, pendingAlerts, completed] =
      await Promise.all([
        dashboardRepository.fleetByStatus(),
        dashboardRepository.tripsByStatus(),
        dashboardRepository.maintenancesByStatus(),
        dashboardRepository.driversTotal(),
        dashboardRepository.driversActive(),
        dashboardRepository.usersTotal(),
        dashboardRepository.pendingAlerts(),
        dashboardRepository.completedTripsSince(since),
      ]);

    const fleetCount = (s: VehicleStatus) => countBy(fleet, s);
    const tripCount = (s: TripStatus) => countBy(trips, s);
    const maintCount = (s: MaintenanceStatus) => countBy(maint, s);

    // Per-month series: pre-seed the last 6 months with 0 so the chart has a
    // continuous axis even for months without completed trips.
    const series = new Map<string, number>();
    for (let i = MONTHS_WINDOW - 1; i >= 0; i--) {
      series.set(monthKey(startOfMonthUtc(i)), 0);
    }
    for (const t of completed) {
      if (!t.finishedAt) continue;
      const key = monthKey(t.finishedAt);
      if (series.has(key)) series.set(key, (series.get(key) ?? 0) + 1);
    }

    return {
      fleet: {
        total: fleet.reduce((sum, r) => sum + r._count, 0),
        available: fleetCount('AVAILABLE'),
        inWorkshop: fleetCount('IN_WORKSHOP'),
        onTrip: fleetCount('ON_TRIP'),
        inactive: fleetCount('INACTIVE'),
      },
      trips: {
        inProgress: tripCount('IN_PROGRESS'),
        pendingAssignment: tripCount('PENDING_ASSIGNMENT'),
        completed: tripCount('COMPLETED'),
      },
      drivers: { total: driversTotal, active: driversActive },
      maintenances: { pending: maintCount('PENDING') + maintCount('IN_PROGRESS') },
      alerts: { pending: pendingAlerts },
      users: { total: usersTotal },
      tripsPerMonth: [...series.entries()].map(([month, count]) => ({ month, count })),
    };
  },
};
