import { api } from './axios';
import type { ApiResponse, PaginationMeta } from './types';

export interface AuditLog {
  id: string;
  user: { id: number; name: string; email: string };
  action: string;
  entity: string;
  entityId: number | null;
  occurredAt: string;
  previousData: unknown;
  newData: unknown;
}

export interface ListAuditLogsParams {
  page: number;
  limit: number;
  entity?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const auditLogsApi = {
  async list(params: ListAuditLogsParams): Promise<{ items: AuditLog[]; total: number }> {
    const { data } = await api.get<ApiResponse<AuditLog[]>>('/audit-logs', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },
};
