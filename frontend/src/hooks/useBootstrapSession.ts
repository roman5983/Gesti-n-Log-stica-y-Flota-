import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { authApi } from '@/api/auth.api';
import { refreshSession } from '@/api/axios';

/**
 * On startup, try to re-hydrate the session from the refresh cookie: the
 * access token lives only in memory and is lost on reload. If refresh
 * succeeds we fetch the current user; either way we mark init as done so the
 * guards can decide.
 *
 * `refreshSession` shares one in-flight request, so StrictMode's double
 * effect invocation in dev doesn't fire two refreshes (which the server's
 * reuse detection would read as a replay and log the user out).
 */
export function useBootstrapSession() {
  const setSession = useAuthStore((s) => s.setSession);
  const setInitialized = useAuthStore((s) => s.setInitialized);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const accessToken = await refreshSession();
        if (cancelled) return;
        const user = await authApi.me();
        if (!cancelled) setSession(user, accessToken);
      } catch {
        // No valid refresh cookie — stay logged out.
      } finally {
        if (!cancelled) setInitialized();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setSession, setInitialized]);
}
