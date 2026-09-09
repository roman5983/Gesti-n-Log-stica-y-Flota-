import { api } from './axios';
import type { ApiResponse, LoginResponse, PublicUser, UserProfile } from './types';

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
    return data.data;
  },

  async me(): Promise<PublicUser> {
    const { data } = await api.get<ApiResponse<PublicUser>>('/auth/me');
    return data.data;
  },

  async profile(): Promise<UserProfile> {
    const { data } = await api.get<ApiResponse<UserProfile>>('/auth/me/profile');
    return data.data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
