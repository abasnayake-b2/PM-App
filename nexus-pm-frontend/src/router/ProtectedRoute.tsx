import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ensureAccessToken } from '@/api/axios';
import { useAuthStore } from '@/store/useAuthStore';
import { useSessionSync } from '@/hooks/useSessionSync';

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();
  const [bootstrapped, setBootstrapped] = useState(() => !!useAuthStore.getState().accessToken);

  useSessionSync();

  useEffect(() => {
    if (accessToken) {
      setBootstrapped(true);
      return;
    }

    let cancelled = false;
    void ensureAccessToken().finally(() => {
      if (!cancelled) setBootstrapped(true);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-text2">
        Restoring session…
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
