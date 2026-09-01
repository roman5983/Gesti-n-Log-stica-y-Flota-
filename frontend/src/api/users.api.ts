import { api } from './axios';
import type { ApiResponse, PaginationMeta, Role } from './types';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListUsersParams {
  page: number;
  limit: number;
  /** Single role or comma-separated list (e.g. "ADMIN,OPERATOR"). */
  role?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * This screen manages administrative accounts only. Drivers are handled in
 * their own module and must never appear here — editing one would fail
 * (the backend blocks role changes on users with a driver profile). The
 * default filter restricts the listing to these roles server-side.
 */
export const ADMINISTRATIVE_ROLES = 'ADMIN,OPERATOR';

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'OPERATOR';
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'password'>> & { password?: string };

export const usersApi = {
  async list(params: ListUsersParams): Promise<{ items: User[]; total: number }> {
    const { data } = await api.get<ApiResponse<User[]>>('/users', { params });
    return { items: data.data, total: (data.meta as PaginationMeta).total };
  },

  async create(input: CreateUserInput): Promise<User> {
    const { data } = await api.post<ApiResponse<User>>('/users', input);
    return data.data;
  },

  async update(id: number, input: UpdateUserInput): Promise<User> {
    const { data } = await api.patch<ApiResponse<User>>(`/users/${id}`, input);
    return data.data;
  },

  async setActive(id: number, active: boolean): Promise<User> {
    const action = active ? 'activate' : 'deactivate';
    const { data } = await api.post<ApiResponse<User>>(`/users/${id}/${action}`);
    return data.data;
  },

  async remove(id: number): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
