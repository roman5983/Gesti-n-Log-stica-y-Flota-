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
  /** DRIVER_DOCUMENT alerts only: the driver that owns the document. */
  linkedDriverId?: number;
}

export interface ListAlertsParams {
  page: number;
  limit: number;
  status?: AlertStatus;
  entityType?: string;
  alertType?: string;
  /** Alerts about one vehicle. */
  vehicleId?: number;
  /** Period on the date the alert was raised, 'YYYY-MM-DD' (inclusive). */
  dateFrom?: string;
  dateTo?: string;
  /** Omitted → inbox order (pending first, newest first). */
  sortBy?: AlertSortField;
  sortOrder?: 'asc' | 'desc';
}

export type AlertSortField = 'raisedAt' | 'alertType';

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
