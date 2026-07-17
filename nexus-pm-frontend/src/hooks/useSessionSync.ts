import { useEffect, useRef } from 'react';
import { fetchCurrentUser } from '@/api/auth.api';
import { useAuthStore } from '@/store/useAuthStore';
import { authUserFromToken } from '@/utils/permissions';

const FOCUS_SYNC_MIN_MS = 30_000;

/** Loads the latest role and permissions from GET /auth/me into the auth store. */
export function useSessionSync() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setSession = useAuthStore((s) => s.setSession);
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;

    const sync = async () => {
      try {
        const data = await fetchCurrentUser();
        if (!cancelled) {
          setSession(data.accessToken, authUserFromToken(data));
          lastSyncAt.current = Date.now();
        }
      } catch {
        // 401 is handled by the axios interceptor
      }
    };

    void sync();

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastSyncAt.current < FOCUS_SYNC_MIN_MS) return;
      void sync();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [accessToken, setSession]);
}
