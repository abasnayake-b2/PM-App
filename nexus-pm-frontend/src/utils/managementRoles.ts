import type { TeamManagement } from '@/api/teamRoster.api';
import type { ProjectFormOption } from '@/components/ProjectForm';

export function partitionManagementRoster<T extends { roleTitle: string }>(rows: T[]) {
  const cLevel: T[] = [];
  const vp: T[] = [];
  const engineering: T[] = [];
  const delivery: T[] = [];
  const coe: T[] = [];
  const other: T[] = [];
  for (const row of rows) {
    if (isCxoRole(row.roleTitle)) {
      cLevel.push(row);
    } else if (isVpRole(row.roleTitle)) {
      vp.push(row);
    } else if (isCoeManagerTitle(row.roleTitle)) {
      coe.push(row);
    } else if (isDeliveryManagerTitle(row.roleTitle)) {
      delivery.push(row);
    } else if (isEngineeringManagerRole(row.roleTitle)) {
      engineering.push(row);
    } else {
      other.push(row);
    }
  }
  return { cLevel, vp, engineering, delivery, coe, other };
}

export function partitionManagersByType<T extends { id: string; roleTitle: string }>(managers: T[]) {
  const engineering: T[] = [];
  const delivery: T[] = [];
  const coe: T[] = [];
  const other: T[] = [];
  for (const manager of managers) {
    if (isCoeManagerTitle(manager.roleTitle)) {
      coe.push(manager);
    } else if (isDeliveryManagerTitle(manager.roleTitle)) {
      delivery.push(manager);
    } else if (isEngineeringManagerRole(manager.roleTitle)) {
      engineering.push(manager);
    } else {
      other.push(manager);
    }
  }
  return { engineering, delivery, coe, other };
}

export type GroupedManagerNames = {
  engineering: string[];
  delivery: string[];
  coe: string[];
  other: string[];
};

export function groupedManagerNames(
  management: { id: string; roleTitle: string; fullName: string; status?: string }[],
  extraNames: string[] = [],
): GroupedManagerNames {
  const active = management.filter((person) => (person.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE');
  const groups = partitionManagementRoster(active);
  const byName = (a: { fullName: string }, b: { fullName: string }) =>
    a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
  const uniqueNames = (names: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(trimmed);
    }
    return out;
  };
  const engineering = uniqueNames([...groups.engineering].sort(byName).map((person) => person.fullName));
  const delivery = uniqueNames([...groups.delivery].sort(byName).map((person) => person.fullName));
  const coe = uniqueNames([...groups.coe].sort(byName).map((person) => person.fullName));
  const listed = new Set([...engineering, ...delivery, ...coe].map((name) => name.toLowerCase()));
  const other = uniqueNames(extraNames.filter((name) => !listed.has(name.trim().toLowerCase()))).sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
  return { engineering, delivery, coe, other };
}

export function isVpRole(roleTitle: string) {
  return /\bvp\b/i.test(roleTitle) || /vice\s+president/i.test(roleTitle);
}

export function isCxoRole(roleTitle: string) {
  if (!roleTitle?.trim() || isVpRole(roleTitle)) return false;
  const title = roleTitle.toLowerCase();
  return /\b(cxo|ceo|coo|cto|cpo)\b/.test(title) || title.includes('chief');
}

/** Short badge for C-suite titles (CEO / COO / …), not a generic "CXO". */
export function shortCxoLabel(roleTitle: string): string {
  const token = roleTitle.match(/\b(CXO|CEO|COO|CTO|CPO)\b/i);
  if (token) return token[1].toUpperCase();
  const title = roleTitle.toLowerCase();
  if (title.includes('chief executive')) return 'CEO';
  if (title.includes('chief operating')) return 'COO';
  if (title.includes('chief technology')) return 'CTO';
  if (title.includes('chief product')) return 'CPO';
  if (title.includes('chief')) return 'CXO';
  return 'CXO';
}

export function isDeliveryManagerTitle(roleTitle?: string | null) {
  return /delivery\s*manager/i.test(roleTitle ?? '');
}

export function isCoeManagerTitle(roleTitle?: string | null) {
  const title = roleTitle ?? '';
  return /\bcoe\b/i.test(title) || /cent(?:er|re)\s+of\s+excellence/i.test(title);
}

export function isEngineeringManagerRole(roleTitle: string) {
  if (!roleTitle?.trim() || isVpRole(roleTitle) || isCxoRole(roleTitle)) return false;
  if (isCoeManagerTitle(roleTitle) || isDeliveryManagerTitle(roleTitle)) return false;
  const title = roleTitle.toLowerCase();
  if (/engineering\s*manager/i.test(title)) return true;
  if (title.includes('senior manager') || title.includes('sr manager') || title.includes('sr. manager')) {
    return true;
  }
  return /\bmanagers?\b/.test(title) || /\bsem\b/.test(title);
}

function normalizeName(value?: string | null): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildManagementIndex(management: TeamManagement[]) {
  const byId = new Map(management.map((person) => [person.id, person]));
  const byName = new Map<string, TeamManagement>();
  for (const person of management) {
    byName.set(normalizeName(person.fullName), person);
  }
  return { byId, byName };
}

export function resolveSupervisorId(
  person: TeamManagement,
  byId: Map<string, TeamManagement>,
  byName: Map<string, TeamManagement>,
): string | undefined {
  if (person.supervisorId && byId.has(person.supervisorId) && person.supervisorId !== person.id) {
    return person.supervisorId;
  }
  const supervisorName = person.supervisorFullName ?? person.supervisorName;
  if (!supervisorName) return undefined;
  const key = normalizeName(supervisorName);
  const exact = byName.get(key);
  if (exact && exact.id !== person.id) return exact.id;

  for (const [name, manager] of byName) {
    if (manager.id === person.id) continue;
    if (name.includes(key) || key.includes(name)) {
      return manager.id;
    }
  }
  return undefined;
}

function buildChildrenBySupervisor(management: TeamManagement[]) {
  const { byId, byName } = buildManagementIndex(management);
  const children = new Map<string, TeamManagement[]>();
  for (const person of management) {
    const supervisorId = resolveSupervisorId(person, byId, byName);
    if (!supervisorId) continue;
    const list = children.get(supervisorId) ?? [];
    list.push(person);
    children.set(supervisorId, list);
  }
  return children;
}

function collectDescendantIds(rootId: string, childrenBySupervisor: Map<string, TeamManagement[]>) {
  const descendants = new Set<string>();
  const queue = [...(childrenBySupervisor.get(rootId) ?? [])];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (descendants.has(current.id)) continue;
    descendants.add(current.id);
    queue.push(...(childrenBySupervisor.get(current.id) ?? []));
  }
  return descendants;
}

export function engineeringManagerIdsUnderVp(management: TeamManagement[], vpId: string): Set<string> {
  return descendantManagerIds(management, vpId, isEngineeringManagerRole);
}

/** EMs, Delivery Managers, and COE Managers reporting under a VP. */
export function lineManagerIdsUnderVp(management: TeamManagement[], vpId: string): Set<string> {
  return descendantManagerIds(
    management,
    vpId,
    (roleTitle) =>
      isEngineeringManagerRole(roleTitle) ||
      isDeliveryManagerTitle(roleTitle) ||
      isCoeManagerTitle(roleTitle),
  );
}

function descendantManagerIds(
  management: TeamManagement[],
  vpId: string,
  roleMatch: (roleTitle: string) => boolean,
): Set<string> {
  const childrenBySupervisor = buildChildrenBySupervisor(management);
  const descendantIds = collectDescendantIds(vpId, childrenBySupervisor);
  const ids = new Set<string>();
  for (const person of management) {
    if (!descendantIds.has(person.id)) continue;
    if (person.status !== 'ACTIVE') continue;
    if (!roleMatch(person.roleTitle)) continue;
    ids.add(person.id);
  }
  return ids;
}

export function toManagementOption(member: TeamManagement): ProjectFormOption {
  return {
    id: member.id,
    label: member.fullName,
    supervisorName: member.supervisorFullName ?? member.supervisorName ?? undefined,
  };
}

export function filterVpOptions(management: TeamManagement[]): ProjectFormOption[] {
  return management
    .filter((m) => m.status === 'ACTIVE' && isVpRole(m.roleTitle))
    .map(toManagementOption);
}

export function filterEngineeringManagerOptions(
  management: TeamManagement[],
  vpManagementId?: string,
): ProjectFormOption[] {
  let candidates = management.filter(
    (m) => m.status === 'ACTIVE' && isEngineeringManagerRole(m.roleTitle),
  );
  if (vpManagementId) {
    const allowedIds = engineeringManagerIdsUnderVp(management, vpManagementId);
    candidates = candidates.filter((m) => allowedIds.has(m.id));
  }
  return candidates
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map(toManagementOption);
}
