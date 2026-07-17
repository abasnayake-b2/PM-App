import { Navigate, Outlet } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

/** Guards admin-area routes — user needs at least one admin-related permission. */
export function AdminRoute() {
  const { showAdminNav } = usePermissions();
  if (!showAdminNav) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
