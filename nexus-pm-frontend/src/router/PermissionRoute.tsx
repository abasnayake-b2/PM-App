import { Navigate, Outlet } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

type PermissionRouteProps = {
  /** User must have this permission */
  permission?: string;
  /** User must have at least one of these permissions */
  anyOf?: string[];
};

/** Route guard — redirects home when the user lacks required permission(s). */
export function PermissionRoute({ permission, anyOf }: PermissionRouteProps) {
  const { can, canAny } = usePermissions();
  const allowed = permission ? can(permission) : anyOf ? canAny(...anyOf) : true;
  if (!allowed) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
