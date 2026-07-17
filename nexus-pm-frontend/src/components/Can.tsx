import { type ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';

type CanProps = {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
  fallback?: ReactNode;
};

/** Renders children only when the user has the required permission(s). */
export function Can({ permission, anyOf, children, fallback = null }: CanProps) {
  const { can, canAny } = usePermissions();
  const allowed = permission ? can(permission) : anyOf ? canAny(...anyOf) : true;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
