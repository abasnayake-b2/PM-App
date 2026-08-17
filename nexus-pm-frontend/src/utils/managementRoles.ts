import type { TeamManagement } from '@/api/teamRoster.api';
import type { ProjectFormOption } from '@/components/ProjectForm';

export function isVpRole(roleTitle: string) {
  return /\bvp\b/i.test(roleTitle);
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

export function isEngineeringManagerRole(roleTitle: string) {
  if (!roleTitle?.trim() || isVpRole(roleTitle) || isCxoRole(roleTitle)) return false;
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
  const childrenBySupervisor = buildChildrenBySupervisor(management);
  const descendantIds = collectDescendantIds(vpId, childrenBySupervisor);
  const ids = new Set<string>();
  for (const person of management) {
    if (!descendantIds.has(person.id)) continue;
    if (person.status !== 'ACTIVE') continue;
    if (!isEngineeringManagerRole(person.roleTitle)) continue;
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
