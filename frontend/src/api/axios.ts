import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { authStore } from '../stores/auth-store';
import type { ApiError, LoginResponse } from './types';

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

/** Main API client. withCredentials so the refresh cookie travels. */
export const api = axios.create({ baseURL, withCredentials: true });

/** Attach the in-memory access token to every request. */
api.interceptors.request.use((config) => {
  const token = authStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Transparent refresh: POST /auth/refresh, update the in-memory token.
 * ALL callers (the 401 interceptor AND the startup bootstrap) go through
 * `refreshSession`, which shares a single in-flight request. This matters
 * with the server's refresh-token reuse detection: two parallel refreshes
 * with the same cookie would look like a replay and revoke every session
 * (e.g. React StrictMode double-invoking the bootstrap effect in dev).
 * A failed refresh clears the session (the app redirects to login).
 */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // A bare axios call (not `api`) to avoid recursive interceptors.
  const { data } = await axios.post<{ data: LoginResponse }>(
    `${baseURL}/auth/refresh`,
    {},
    { withCredentials: true },
  );
  const token = data.data.accessToken;
  authStore.setAccessToken(token);
  return token;
}

export function refreshSession(): Promise<string> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthEndpoint = original?.url?.includes('/auth/');

    if (error.response?.status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        const token = await refreshSession();
        original.headers = { ...original.headers, Authorization: `Bearer ${token}` };
        return api.request(original);
      } catch {
        authStore.clear();
      }
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an API error (for toasts/forms). */
export function apiErrorMessage(err: unknown, fallback = 'Ocurrió un error'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiError | undefined;
    return data?.error?.message ?? fallback;
  }
  return fallback;
}
