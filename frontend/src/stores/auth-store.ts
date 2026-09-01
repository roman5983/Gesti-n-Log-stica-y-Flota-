import { create } from 'zustand';
import type { PublicUser } from '../api/types';

/**
 * Session store (Zustand). The access token lives in memory only (never in
 * localStorage) to minimize XSS exposure; the refresh token is an httpOnly
 * cookie handled by the browser. On a full page reload the token is gone and
 * the app silently re-hydrates the session via POST /auth/refresh (see
 * bootstrapSession in App).
 */
interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  /** True until the initial refresh attempt has resolved. */
  initializing: boolean;
  setSession: (user: PublicUser, accessToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  clearSession: () => void;
  setInitialized: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  initializing: true,
  setSession: (user, accessToken) => set({ user, accessToken }),
  setAccessToken: (accessToken) => set({ accessToken }),
  clearSession: () => set({ user: null, accessToken: null }),
  setInitialized: () => set({ initializing: false }),
}));

/** Non-reactive accessors for use outside React (e.g. Axios interceptors). */
export const authStore = {
  getAccessToken: () => useAuthStore.getState().accessToken,
  setAccessToken: (token: string) => useAuthStore.getState().setAccessToken(token),
  clear: () => useAuthStore.getState().clearSession(),
};
