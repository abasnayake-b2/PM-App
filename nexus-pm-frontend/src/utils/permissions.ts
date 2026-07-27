/** Permission codes — keep in sync with backend Roles & access matrix. */
export const P = {
  USERS_VIEW: 'USERS_VIEW',
  USERS_CREATE: 'USERS_CREATE',
  USERS_UPDATE: 'USERS_UPDATE',
  USERS_DELETE: 'USERS_DELETE',
  PROJECTS_VIEW: 'PROJECTS_VIEW',
  PROJECTS_CREATE: 'PROJECTS_CREATE',
  PROJECTS_UPDATE: 'PROJECTS_UPDATE',
  PROJECTS_DELETE: 'PROJECTS_DELETE',
  ISSUES_VIEW: 'ISSUES_VIEW',
  ISSUES_CREATE: 'ISSUES_CREATE',
  ISSUES_UPDATE: 'ISSUES_UPDATE',
  ISSUES_DELETE: 'ISSUES_DELETE',
  ALLOCATIONS_VIEW: 'ALLOCATIONS_VIEW',
  ALLOCATIONS_CREATE: 'ALLOCATIONS_CREATE',
  ALLOCATIONS_UPDATE: 'ALLOCATIONS_UPDATE',
  ALLOCATIONS_DELETE: 'ALLOCATIONS_DELETE',
  REPORTS_VIEW: 'REPORTS_VIEW',
  ORGANISATIONS_VIEW: 'ORGANISATIONS_VIEW',
  ORGANISATIONS_CREATE: 'ORGANISATIONS_CREATE',
  ORGANISATIONS_UPDATE: 'ORGANISATIONS_UPDATE',
  ORGANISATIONS_DELETE: 'ORGANISATIONS_DELETE',
  TEAM_VIEW: 'TEAM_VIEW',
  TEAM_CREATE: 'TEAM_CREATE',
  TEAM_UPDATE: 'TEAM_UPDATE',
  TEAM_DELETE: 'TEAM_DELETE',
  ADMIN_VIEW: 'ADMIN_VIEW',
  ADMIN_CREATE: 'ADMIN_CREATE',
  ADMIN_UPDATE: 'ADMIN_UPDATE',
  ADMIN_DELETE: 'ADMIN_DELETE',
  REFERENCE_VIEW: 'REFERENCE_VIEW',
  REFERENCE_CREATE: 'REFERENCE_CREATE',
  REFERENCE_UPDATE: 'REFERENCE_UPDATE',
  REFERENCE_DELETE: 'REFERENCE_DELETE',
  IMPORT_VIEW: 'IMPORT_VIEW',
  IMPORT_CREATE: 'IMPORT_CREATE',
  RELEASES_VIEW: 'RELEASES_VIEW',
  RELEASES_CREATE: 'RELEASES_CREATE',
  ORG_STRUCTURE_VIEW: 'ORG_STRUCTURE_VIEW',
  PMO_VIEW: 'PMO_VIEW',
  PMO_CREATE: 'PMO_CREATE',
  PMO_UPDATE: 'PMO_UPDATE',
  PMO_DELETE: 'PMO_DELETE',
  AI_ASSISTANT_VIEW: 'AI_ASSISTANT_VIEW',
} as const;

export type PermissionCode = (typeof P)[keyof typeof P];

/** Matches backend PermissionChecker org-leadership roles. */
const ORG_LEADERSHIP_ROLES = new Set([
  'CXO',
  'VP',
  'MANAGER',
  'CEO',
  'CTO',
  'VP_ENG',
  'SR_SEM',
  'SEM',
  'TECH_LEAD',
]);

/** Mirrors backend PermissionChecker.can() */
export function canPermission(
  role: string | null | undefined,
  permissionCodes: string[] | undefined,
  code: string,
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (permissionCodes?.includes(code)) return true;
  if (role === 'ADMIN') return true;
  // Legacy parity with backend: org leaders can manage allocations
  if (ORG_LEADERSHIP_ROLES.has(role) && code.startsWith('ALLOCATIONS_')) return true;
  return false;
}

export function canAnyPermission(
  role: string | null | undefined,
  permissionCodes: string[] | undefined,
  codes: string[],
): boolean {
  return codes.some((code) => canPermission(role, permissionCodes, code));
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** Any permission that unlocks the Admin navigation group. */
export function hasAdminNavAccess(
  role: string | null | undefined,
  permissionCodes: string[] | undefined,
): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  return canAnyPermission(role, permissionCodes, [
    P.USERS_VIEW,
    P.ADMIN_VIEW,
    P.REFERENCE_VIEW,
  ]);
}

export function authUserFromToken(data: {
  userId: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string;
  passwordChangeDue?: boolean;
  passwordAgeDays?: number;
  permissionCodes?: string[];
  orgWideVisibility?: boolean;
}): import('@/types').AuthUser {
  return {
    userId: data.userId,
    email: data.email,
    name: data.name,
    role: data.role,
    departmentId: data.departmentId,
    passwordChangeDue: data.passwordChangeDue,
    passwordAgeDays: data.passwordAgeDays,
    permissionCodes: data.permissionCodes ?? [],
    orgWideVisibility:
      data.orgWideVisibility ??
      (data.role === 'VP' || data.role === 'VP_ENG' || data.role === 'CXO' || data.role === 'CTO'),
  };
}
