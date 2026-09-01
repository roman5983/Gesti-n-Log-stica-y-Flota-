import { api } from './axios';
import type { ApiResponse, PaginationMeta } from './types';

export type AlertStatus = 'PENDING' | 'RESOLVED';

export interface Alert {
  id: number;
  alertType: string;
  description: string;
  entityType: string;
  entityId: number;
  status: AlertStatus;
  raisedAt: string;
  resolvedById: number | null;
  resolvedAt: string | null;
}

export interface ListAlertsParams {
  page: number;
  limit: number;
  status?: AlertStatus;
  entityType?: string;
}

export const alertsApi = {
  async list(params: ListAlertsParams): Promise<{ items: Alert[]; total: number }> {
    const { data } = await api.get<ApiResponse<Alert[]>>('/alerts', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async evaluate(): Promise<{ evaluated: number; created: number; autoResolved: number }> {
    const { data } = await api.post<ApiResponse<{ evaluated: number; created: number; autoResolved: number }>>('/alerts/evaluate');
    return data.data;
  },

  async resolve(id: number): Promise<Alert> {
    const { data } = await api.post<ApiResponse<Alert>>(`/alerts/${id}/resolve`);
    return data.data;
  },
};
