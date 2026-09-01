import { api } from './axios';
import type { ApiResponse, PaginationMeta } from './types';

export interface MaintenanceType {
  id: number;
  name: string;
  description: string;
  kmAlert: number;
  kmTarget: number;
  monthsAlert: number | null;
  monthsTarget: number | null;
}

export interface MaintenanceTypeInput {
  name: string;
  description: string;
  kmAlert: number;
  kmTarget: number;
  monthsAlert?: number;
  monthsTarget?: number;
}

export const maintenanceTypesApi = {
  async list(params: { page: number; limit: number }): Promise<{ items: MaintenanceType[]; total: number }> {
    const { data } = await api.get<ApiResponse<MaintenanceType[]>>('/maintenance-types', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async create(input: MaintenanceTypeInput): Promise<MaintenanceType> {
    const { data } = await api.post<ApiResponse<MaintenanceType>>('/maintenance-types', input);
    return data.data;
  },

  async update(id: number, input: MaintenanceTypeInput): Promise<MaintenanceType> {
    const { data } = await api.put<ApiResponse<MaintenanceType>>(`/maintenance-types/${id}`, input);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/maintenance-types/${id}`);
  },
};
