import { api } from './axios';
import type { ApiResponse } from './types';

export interface TripReport {
  period: { from: string; to: string };
  summary: {
    completedTrips: number;
    totalKm: number;
    averageDistanceKm: number;
    maintenancesCompleted: number;
    alertsRaised: number;
    alertsResolved: number;
  };
  byDriver: { driverId: number; name: string; dni: string; tripCount: number; totalKm: number }[];
  byVehicle: { vehicleId: number; licensePlate: string; model: string; tripCount: number; totalKm: number }[];
  topDestinations: { destination: string; tripCount: number }[];
}

export const reportsApi = {
  async trips(dateFrom: string, dateTo: string): Promise<TripReport> {
    const { data } = await api.get<ApiResponse<TripReport>>('/reports/trips', {
      params: { dateFrom, dateTo },
    });
    return data.data;
  },
};
