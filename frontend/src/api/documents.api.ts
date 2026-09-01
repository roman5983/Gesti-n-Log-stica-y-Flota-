import { api } from './axios';
import { openBlobInNewTab } from '../utils/blob';
import type { ApiResponse } from './types';

export type DocumentType = 'DNI' | 'LICENSE' | 'ART' | 'PSYCHOPHYSICAL';

export interface DriverDocument {
  id: number;
  driverId: number;
  documentType: DocumentType;
  expiryDate: string;
  expired: boolean;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedAt: string;
}

export const documentsApi = {
  async list(driverId: number): Promise<DriverDocument[]> {
    const { data } = await api.get<ApiResponse<DriverDocument[]>>(`/drivers/${driverId}/documents`);
    return data.data;
  },

  async upload(
    driverId: number,
    documentType: DocumentType,
    expiryDate: string,
    file: File,
  ): Promise<DriverDocument> {
    const form = new FormData();
    form.append('documentType', documentType);
    form.append('expiryDate', expiryDate);
    form.append('file', file);
    const { data } = await api.post<ApiResponse<DriverDocument>>(
      `/drivers/${driverId}/documents`,
      form,
    );
    return data.data;
  },

  async remove(driverId: number, documentId: number): Promise<void> {
    await api.delete(`/drivers/${driverId}/documents/${documentId}`);
  },

  /**
   * Open a document in a new tab (authenticated blob — token is in memory).
   * Uses an <a target="_blank"> click instead of window.open: window.open
   * after an await loses the user-gesture and gets blocked as a popup.
   */
  async open(driverId: number, documentId: number): Promise<void> {
    const response = await api.get(`/drivers/${driverId}/documents/${documentId}`, {
      responseType: 'blob',
    });
    openBlobInNewTab(response.data as Blob);
  },
};
