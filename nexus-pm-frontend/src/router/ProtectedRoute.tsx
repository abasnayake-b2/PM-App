import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useSessionSync } from '@/hooks/useSessionSync';

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  useSessionSync();

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
