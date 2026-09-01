import { useAuthStore } from '../stores/auth-store';
import { authApi } from '../api/auth.api';

/** Session hook: exposes the current user and session actions to components. */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const initializing = useAuthStore((s) => s.initializing);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  async function login(email: string, password: string): Promise<void> {
    const { user: loggedUser, accessToken } = await authApi.login(email, password);
    setSession(loggedUser, accessToken);
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }

  return { user, initializing, isAuthenticated: user !== null, login, logout };
}
