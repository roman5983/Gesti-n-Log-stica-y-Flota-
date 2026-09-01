import { api } from './axios';
import type { ApiResponse } from './types';

export interface CompanySettings {
  companyName: string;
  taxId: string;
  address: string;
  phone: string;
  email: string;
  timezone: string;
  language: string;
  dateFormat: string;
  updatedAt: string;
}

export type UpdateSettingsInput = Partial<Omit<CompanySettings, 'updatedAt'>>;

export const settingsApi = {
  async get(): Promise<CompanySettings> {
    const { data } = await api.get<ApiResponse<CompanySettings>>('/settings');
    return data.data;
  },

  async update(input: UpdateSettingsInput): Promise<CompanySettings> {
    const { data } = await api.put<ApiResponse<CompanySettings>>('/settings', input);
    return data.data;
  },
};
