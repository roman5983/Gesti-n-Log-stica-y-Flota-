import { api } from './axios';
import { openBlobInNewTab } from '../utils/blob';
import type { ApiResponse, PaginationMeta } from './types';

export type MaintenanceStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export interface MaintenanceAttachment {
  id: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export interface Maintenance {
  id: number;
  vehicle: { id: number; licensePlate: string; model: string };
  maintenanceType: { id: number; name: string };
  status: MaintenanceStatus;
  scheduledAt: string;
  completedAt: string | null;
  km: number;
  notes: string | null;
  nextMaintenanceKm: number | null;
  attachments: MaintenanceAttachment[];
}

export interface ListMaintenancesParams {
  page: number;
  limit: number;
  vehicleId?: number;
  status?: MaintenanceStatus;
  view?: 'scheduled' | 'history';
}

export interface CreateMaintenanceInput {
  vehicleId: number;
  maintenanceTypeId: number;
  scheduledAt: string;
  km: number;
  notes?: string;
  nextMaintenanceKm?: number;
}

export const maintenancesApi = {
  async list(params: ListMaintenancesParams): Promise<{ items: Maintenance[]; total: number }> {
    const { data } = await api.get<ApiResponse<Maintenance[]>>('/maintenances', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async create(input: CreateMaintenanceInput): Promise<Maintenance> {
    const { data } = await api.post<ApiResponse<Maintenance>>('/maintenances', input);
    return data.data;
  },

  async start(id: number): Promise<Maintenance> {
    const { data } = await api.post<ApiResponse<Maintenance>>(`/maintenances/${id}/start`);
    return data.data;
  },

  async complete(id: number): Promise<Maintenance> {
    const { data } = await api.post<ApiResponse<Maintenance>>(`/maintenances/${id}/complete`);
    return data.data;
  },

  async addAttachment(id: number, file: File): Promise<Maintenance> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ApiResponse<Maintenance>>(`/maintenances/${id}/attachments`, form);
    return data.data;
  },

  /**
   * Open an attachment in a new tab. Fetched as an authenticated blob (the
   * token is in memory) and opened via an <a> click — window.open after an
   * await is blocked as a popup.
   */
  async openAttachment(maintenanceId: number, attachmentId: number): Promise<void> {
    const response = await api.get(`/maintenances/${maintenanceId}/attachments/${attachmentId}`, {
      responseType: 'blob',
    });
    openBlobInNewTab(response.data as Blob);
  },
};
