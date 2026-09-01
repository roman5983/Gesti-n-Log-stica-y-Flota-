import { api } from './axios';
import type { ApiResponse, PaginationMeta } from './types';

export type LicenseCategory = 'A' | 'B' | 'C' | 'E';

export interface Driver {
  id: number; // userId
  name: string;
  email: string;
  isActive: boolean;
  dni: string;
  licenseCategory: LicenseCategory;
  licenseExpiryDate: string;
  licenseValid: boolean;
  available: boolean;
  completedTrips: number;
  avgKm: number;
}

export interface ListDriversParams {
  page: number;
  limit: number;
  available?: boolean;
  search?: string;
}

export interface CreateDriverInput {
  name: string;
  email: string;
  password: string;
  dni: string;
  licenseCategory: LicenseCategory;
  licenseExpiryDate: string;
}

export type UpdateDriverInput = Partial<Omit<CreateDriverInput, 'password'>>;

export const driversApi = {
  async list(params: ListDriversParams): Promise<{ items: Driver[]; total: number }> {
    const { data } = await api.get<ApiResponse<Driver[]>>('/drivers', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async getById(id: number): Promise<Driver> {
    const { data } = await api.get<ApiResponse<Driver>>(`/drivers/${id}`);
    return data.data;
  },

  async create(input: CreateDriverInput): Promise<Driver> {
    const { data } = await api.post<ApiResponse<Driver>>('/drivers', input);
    return data.data;
  },

  async update(id: number, input: UpdateDriverInput): Promise<Driver> {
    const { data } = await api.patch<ApiResponse<Driver>>(`/drivers/${id}`, input);
    return data.data;
  },

  /** A-9: Admin can view the driver's password (decrypted). Leaves an audit trail. */
  async getPassword(id: number): Promise<string> {
    const { data } = await api.get<ApiResponse<{ password: string }>>(`/drivers/${id}/password`);
    return data.data.password;
  },

  async changePassword(id: number, password: string): Promise<void> {
    await api.put(`/drivers/${id}/password`, { password });
  },
};
