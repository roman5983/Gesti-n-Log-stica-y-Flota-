import { utcEndOfDay } from '../../shared/utils/dates';
import { reportsRepository, type ReportTrip } from './reports.repository';
import type { ReportQuery } from './reports.schemas';

interface DriverBreakdown {
  driverId: number;
  name: string;
  dni: string;
  tripCount: number;
  totalKm: number;
}

interface VehicleBreakdown {
  vehicleId: number;
  licensePlate: string;
  model: string;
  tripCount: number;
  totalKm: number;
}

interface DestinationBreakdown {
  destination: string;
  tripCount: number;
}

export interface TripReport {
  period: { from: Date; to: Date };
  summary: {
    completedTrips: number;
    totalKm: number;
    averageDistanceKm: number;
    maintenancesCompleted: number;
    alertsRaised: number;
    alertsResolved: number;
  };
  byDriver: DriverBreakdown[];
  byVehicle: VehicleBreakdown[];
  topDestinations: DestinationBreakdown[];
}

/** Per-trip distance (RN-5 guarantees arrival > departure when both set). */
function tripKm(trip: ReportTrip): number {
  if (trip.arrivalKm === null || trip.departureKm === null) return 0;
  return trip.arrivalKm - trip.departureKm;
}

function aggregateByDriver(trips: ReportTrip[]): DriverBreakdown[] {
  const map = new Map<number, DriverBreakdown>();
  for (const trip of trips) {
    if (!trip.driver) continue;
    const id = trip.driver.userId;
    const entry =
      map.get(id) ??
      { driverId: id, name: trip.driver.user.name, dni: trip.driver.dni, tripCount: 0, totalKm: 0 };
    entry.tripCount += 1;
    entry.totalKm += tripKm(trip);
    map.set(id, entry);
  }
  return [...map.values()].sort((a, b) => b.tripCount - a.tripCount);
}

function aggregateByVehicle(trips: ReportTrip[]): VehicleBreakdown[] {
  const map = new Map<number, VehicleBreakdown>();
  for (const trip of trips) {
    if (!trip.vehicle) continue;
    const id = trip.vehicle.id;
    const entry =
      map.get(id) ??
      {
        vehicleId: id,
        licensePlate: trip.vehicle.licensePlate,
        model: trip.vehicle.model,
        tripCount: 0,
        totalKm: 0,
      };
    entry.tripCount += 1;
    entry.totalKm += tripKm(trip);
    map.set(id, entry);
  }
  return [...map.values()].sort((a, b) => b.tripCount - a.tripCount);
}

function topDestinations(trips: ReportTrip[], limit = 10): DestinationBreakdown[] {
  const map = new Map<string, number>();
  for (const trip of trips) {
    map.set(trip.destination, (map.get(trip.destination) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([destination, tripCount]) => ({ destination, tripCount }))
    .sort((a, b) => b.tripCount - a.tripCount)
    .slice(0, limit);
}

export const reportsService = {
  async tripReport(query: ReportQuery): Promise<TripReport> {
    const from = query.dateFrom;
    const to = utcEndOfDay(query.dateTo);

    const [trips, maintenancesCompleted, alertsRaised, alertsResolved] = await Promise.all([
      reportsRepository.completedTrips(from, to),
      reportsRepository.countMaintenancesCompleted(from, to),
      reportsRepository.countAlertsRaised(from, to),
      reportsRepository.countAlertsResolved(from, to),
    ]);

    const totalKm = trips.reduce((sum, t) => sum + tripKm(t), 0);
    const completedTrips = trips.length;
    const averageDistanceKm =
      completedTrips > 0 ? Math.round((totalKm / completedTrips) * 100) / 100 : 0;

    return {
      period: { from, to },
      summary: {
        completedTrips,
        totalKm,
        averageDistanceKm,
        maintenancesCompleted,
        alertsRaised,
        alertsResolved,
      },
      byDriver: aggregateByDriver(trips),
      byVehicle: aggregateByVehicle(trips),
      topDestinations: topDestinations(trips),
    };
  },
};
