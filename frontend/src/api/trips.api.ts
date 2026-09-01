import { api } from './axios';
import type { ApiResponse, PaginationMeta } from './types';

export type TripStatus = 'PENDING_ASSIGNMENT' | 'IN_PROGRESS' | 'COMPLETED';

export interface Trip {
  id: number;
  origin: string;
  destination: string;
  departureAt: string;
  status: TripStatus;
  estimatedDistanceKm: number | null;
  estimatedTimeMin: number | null;
  notes: string | null;
  operator: { id: number; name: string };
  driver: { id: number; name: string; dni: string } | null;
  vehicle: { id: number; licensePlate: string; model: string } | null;
  departureKm: number | null;
  arrivalKm: number | null;
  assignedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export interface ListTripsParams {
  page: number;
  limit: number;
  status?: TripStatus;
  driverId?: number;
  vehicleId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateTripInput {
  destination: string;
  departureAt: string;
  notes?: string;
  estimatedDistanceKm?: number;
  estimatedTimeMin?: number;
}

export const tripsApi = {
  async list(params: ListTripsParams): Promise<{ items: Trip[]; total: number }> {
    const { data } = await api.get<ApiResponse<Trip[]>>('/trips', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async getById(id: number): Promise<Trip> {
    const { data } = await api.get<ApiResponse<Trip>>(`/trips/${id}`);
    return data.data;
  },

  async create(input: CreateTripInput): Promise<Trip> {
    const { data } = await api.post<ApiResponse<Trip>>('/trips', input);
    return data.data;
  },

  async update(id: number, input: Partial<CreateTripInput>): Promise<Trip> {
    const { data } = await api.patch<ApiResponse<Trip>>(`/trips/${id}`, input);
    return data.data;
  },

  /** Operator picks the driver; the system auto-assigns the vehicle (RN-12). */
  async assign(id: number, driverId: number): Promise<Trip> {
    const { data } = await api.post<ApiResponse<Trip>>(`/trips/${id}/assign`, { driverId });
    return data.data;
  },

  async finish(id: number, arrivalKm: number): Promise<Trip> {
    const { data } = await api.post<ApiResponse<Trip>>(`/trips/${id}/finish`, { arrivalKm });
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/trips/${id}`);
  },
};
