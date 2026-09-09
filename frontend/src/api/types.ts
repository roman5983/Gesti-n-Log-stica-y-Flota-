/** Shared API types mirroring the backend response envelope. */

export type Role = 'ADMIN' | 'OPERATOR' | 'DRIVER';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
  role: Role;
}

/** Success envelope: { data, meta? }. */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

/** Error envelope: { error: { code, message, details? } }. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface LoginResponse {
  user: PublicUser;
  accessToken: string;
}

export type LicenseCategory = 'A' | 'B' | 'C' | 'E';

/** Read-only "Mis datos" profile of the current user (all roles). */
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  driver: {
    dni: string;
    licenseCategory: LicenseCategory;
    licenseExpiryDate: string;
    completedTrips: number;
    avgKm: number;
  } | null;
}
