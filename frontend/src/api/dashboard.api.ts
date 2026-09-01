import { api } from './axios';
import type { ApiResponse } from './types';

export interface DashboardMetrics {
  fleet: { total: number; available: number; inWorkshop: number; onTrip: number; inactive: number };
  trips: { inProgress: number; pendingAssignment: number; completed: number };
  drivers: { total: number; active: number };
  maintenances: { pending: number };
  alerts: { pending: number };
  users: { total: number };
  tripsPerMonth: { month: string; count: number }[];
}

export const dashboardApi = {
  async metrics(): Promise<DashboardMetrics> {
    const { data } = await api.get<ApiResponse<DashboardMetrics>>('/dashboard');
    return data.data;
  },
};
