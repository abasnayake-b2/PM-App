export type SystemRole = 'SUPER_ADMIN' | 'ADMIN' | 'CXO' | 'VP' | 'MANAGER' | 'EMPLOYEE';

export const SYSTEM_ROLE_OPTIONS: { code: SystemRole; label: string }[] = [
  { code: 'SUPER_ADMIN', label: 'Super Admin' },
  { code: 'ADMIN', label: 'Admin' },
  { code: 'CXO', label: 'CXO' },
  { code: 'VP', label: 'VP' },
  { code: 'MANAGER', label: 'Manager / Senior Manager' },
  { code: 'EMPLOYEE', label: 'Employee' },
];

const ORG_LEADER_ROLES = new Set([
  'CXO',
  'VP',
  'MANAGER',
  'CTO',
  'VP_ENG',
  'SR_SEM',
  'SEM',
  'TECH_LEAD',
]);

export function isAdminRole(role?: string | null): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export function isManagerRole(role?: string | null): boolean {
  return !!role && ORG_LEADER_ROLES.has(role);
}

export function isManagerOrAboveRole(role?: string | null): boolean {
  return isAdminRole(role) || isManagerRole(role);
}

export function isScopedEngineeringManagerRole(role?: string | null): boolean {
  return role === 'MANAGER' || role === 'SEM' || role === 'SR_SEM';
}

export function isSuperAdminRole(role?: string | null): boolean {
  return role === 'SUPER_ADMIN';
}

/** CXO / VP (and legacy titles) — typically portfolio-wide; VP can opt into own-team via toggle. */
export function isPortfolioWideRole(role?: string | null): boolean {
  return role === 'CXO' || role === 'CTO' || role === 'VP' || role === 'VP_ENG';
}

/** Roles that can use the Own team / Org-wide visibility toggle. */
export function supportsVisibilityToggle(role?: string | null): boolean {
  return isScopedEngineeringManagerRole(role) || role === 'VP' || role === 'VP_ENG';
}

/** Effective org-wide data access for dashboards / capacity. */
export function hasOrgWideVisibility(role?: string | null, orgWideVisibility?: boolean): boolean {
  if (isAdminRole(role) || role === 'CXO' || role === 'CTO') return true;
  if (role === 'VP' || role === 'VP_ENG') return orgWideVisibility !== false;
  if (isScopedEngineeringManagerRole(role)) return !!orgWideVisibility;
  return false;
}

/** Org overview / By VP dashboard widgets. */
export function canViewOrgDashboard(role?: string | null, orgWideVisibility = false): boolean {
  return hasOrgWideVisibility(role, orgWideVisibility);
}

/** Default toggle value when selecting a role in the user form. */
export function defaultOrgWideVisibility(role?: string | null): boolean {
  return role === 'VP' || role === 'VP_ENG';
}

/** Product reporting line used for manager assignment checks. */
export const ORG_HIERARCHY = ['CXO', 'VP', 'MANAGER', 'EMPLOYEE'] as const;

const SUPERVISOR_ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 0,
  ADMIN: 0,
  CXO: 1,
  CTO: 1,
  CEO: 1,
  VP: 2,
  VP_ENG: 2,
  MANAGER: 3,
  SEM: 3,
  SR_SEM: 3,
  EMPLOYEE: 4,
  SW_ENGINEER: 4,
  TECH_LEAD: 4,
};

/** Minimum supervisor rank required for a role (lower number = more senior). Null = no supervisor allowed. */
export function requiredSupervisorRank(roleCode?: string | null): number | null {
  switch (roleCode) {
    case 'CXO':
    case 'CTO':
    case 'CEO':
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return null;
    case 'VP':
    case 'VP_ENG':
      return 1; // CXO or admin
    case 'MANAGER':
    case 'SEM':
    case 'SR_SEM':
      return 2; // VP or more senior
    case 'EMPLOYEE':
    case 'SW_ENGINEER':
    case 'TECH_LEAD':
      return 3; // Manager or more senior
    default:
      return null;
  }
}

export function canSuperviseRole(supervisorRole?: string | null, subordinateRole?: string | null): boolean {
  const required = requiredSupervisorRank(subordinateRole);
  if (required == null) {
    return !supervisorRole; // top roles should have no manager
  }
  if (!supervisorRole) return false;
  if (isAdminRole(supervisorRole)) return true;
  const rank = SUPERVISOR_ROLE_RANK[supervisorRole];
  return rank != null && rank <= required;
}

export function supervisorRequirementHint(roleCode?: string | null): string {
  switch (roleCode) {
    case 'CXO':
    case 'SUPER_ADMIN':
    case 'ADMIN':
      return 'This role sits at the top of the line — leave Manager empty.';
    case 'VP':
      return 'VP must report to a CXO (or Super Admin / Admin).';
    case 'MANAGER':
      return 'Manager / Senior Manager must report to a VP (or more senior).';
    case 'EMPLOYEE':
      return 'Employee must report to a Manager (or more senior).';
    default:
      return 'Select a supervisor that matches the reporting line: CXO → VP → Manager → Employee.';
  }
}

