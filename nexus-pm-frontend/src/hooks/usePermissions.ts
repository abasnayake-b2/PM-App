import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import {
  canAnyPermission,
  canPermission,
  hasAdminNavAccess,
  isSuperAdminRole,
} from '@/utils/permissions';

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const role = user?.role;
  const permissionCodes = user?.permissionCodes ?? [];

  const can = useCallback(
    (code: string) => canPermission(role, permissionCodes, code),
    [role, permissionCodes],
  );

  const canAny = useCallback(
    (...codes: string[]) => canAnyPermission(role, permissionCodes, codes),
    [role, permissionCodes],
  );

  const superAdmin = useMemo(() => isSuperAdminRole(role), [role]);
  const showAdminNav = useMemo(
    () => hasAdminNavAccess(role, permissionCodes),
    [role, permissionCodes],
  );

  return {
    user,
    role,
    permissionCodes,
    can,
    canAny,
    superAdmin,
    showAdminNav,
  };
}
