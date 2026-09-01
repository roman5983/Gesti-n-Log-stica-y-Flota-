import { api } from './axios';
import type { ApiResponse, PaginationMeta } from './types';

export type VehicleStatus = 'AVAILABLE' | 'INACTIVE' | 'IN_WORKSHOP' | 'ON_TRIP';

export interface Vehicle {
  id: number;
  licensePlate: string;
  model: string;
  year: number;
  initialKm: number;
  accumulatedKm: number;
  lastMaintenanceDate: string | null;
  insuranceExpiryDate: string | null;
  insuranceValid: boolean;
  status: VehicleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ListVehiclesParams {
  page: number;
  limit: number;
  status?: VehicleStatus;
  search?: string;
}

export interface CreateVehicleInput {
  licensePlate: string;
  model: string;
  year: number;
  initialKm: number;
  insuranceExpiryDate?: string;
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export const vehiclesApi = {
  async list(params: ListVehiclesParams): Promise<{ items: Vehicle[]; total: number }> {
    const { data } = await api.get<ApiResponse<Vehicle[]>>('/vehicles', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async create(input: CreateVehicleInput): Promise<Vehicle> {
    const { data } = await api.post<ApiResponse<Vehicle>>('/vehicles', input);
    return data.data;
  },

  async update(id: number, input: UpdateVehicleInput): Promise<Vehicle> {
    const { data } = await api.patch<ApiResponse<Vehicle>>(`/vehicles/${id}`, input);
    return data.data;
  },

  async setActive(id: number, active: boolean): Promise<Vehicle> {
    const action = active ? 'activate' : 'deactivate';
    const { data } = await api.post<ApiResponse<Vehicle>>(`/vehicles/${id}/${action}`);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/vehicles/${id}`);
  },
};
