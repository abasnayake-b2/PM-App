import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, UserCircle, Users } from 'lucide-react';
import { useTeamManagement, useTeamRosterMembers } from '@/hooks/useTeamRoster';
import type { TeamManagement, TeamRosterMember } from '@/api/teamRoster.api';

type NodeKind = 'manager' | 'employee';

function nodeKey(kind: NodeKind, id: string) {
  return `${kind}:${id}`;
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

function resolveSupervisorId(
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

function TreeRow({
  depth,
  expanded,
  hasChildren,
  onToggle,
  icon,
  label,
  meta,
  subMeta,
  selected,
  warning,
  onLabelClick,
}: {
  depth: number;
  expanded: boolean;
  hasChildren: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  meta?: string;
  subMeta?: string;
  selected?: boolean;
  warning?: string;
  onLabelClick?: () => void;
}) {
  const labelContent = onLabelClick ? (
    <button type="button" onClick={onLabelClick} className="font-medium text-left hover:text-accent">
      {label}
    </button>
  ) : (
    <span className="font-medium">{label}</span>
  );

  return (
    <div
      className={`flex items-center gap-2 border-t border-border py-2 pr-3 hover:bg-bg2/50 ${
        selected ? 'bg-accent/10' : ''
      }`}
      style={{ paddingLeft: `${12 + depth * 20}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasChildren}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text2 hover:bg-bg3 disabled:invisible"
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
      </button>
      <span className="shrink-0 text-accent">{icon}</span>
      <div className="min-w-0 flex-1">
        {labelContent}
        {meta && <span className="ml-2 text-sm text-text2">{meta}</span>}
        {subMeta && <p className="text-xs text-text2">{subMeta}</p>}
        {warning && <p className="text-xs text-warning">{warning}</p>}
      </div>
    </div>
  );
}

interface ManagementOrgTreeProps {
  canEdit?: boolean;
  selectedId?: string | null;
  onSelect?: (person: TeamManagement) => void;
}

export function ManagementOrgTree({ canEdit = false, selectedId, onSelect }: ManagementOrgTreeProps) {
  const { data: management = [], isLoading: managementLoading } = useTeamManagement();
  const { data: members = [], isLoading: membersLoading } = useTeamRosterMembers();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const { byId, byName } = useMemo(() => buildManagementIndex(management), [management]);

  const childrenBySupervisor = useMemo(() => {
    const map = new Map<string, TeamManagement[]>();
    for (const person of management) {
      const supervisorId = resolveSupervisorId(person, byId, byName);
      if (!supervisorId) continue;
      const list = map.get(supervisorId) ?? [];
      list.push(person);
      map.set(supervisorId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return map;
  }, [management, byId, byName]);

  const employeesByManager = useMemo(() => {
    const map = new Map<string, TeamRosterMember[]>();
    for (const member of members) {
      const key = member.engineeringManagerManagementId ?? normalizeName(member.engineeringManagerName);
      if (!key) continue;
      const list = map.get(key) ?? [];
      list.push(member);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }
    return map;
  }, [members]);

  const roots = useMemo(
    () =>
      management
        .filter((person) => {
          const supervisorId = resolveSupervisorId(person, byId, byName);
          return !supervisorId;
        })
        .sort(
          (a, b) => a.roleTitle.localeCompare(b.roleTitle) || a.fullName.localeCompare(b.fullName),
        ),
    [management, byId, byName],
  );

  const isLoading = managementLoading || membersLoading;

  const toggle = (key: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const collectKeys = (person: TeamManagement): string[] => {
    const keys = [nodeKey('manager', person.id)];
    const reports = childrenBySupervisor.get(person.id) ?? [];
    for (const child of reports) {
      keys.push(...collectKeys(child));
    }
    const team = employeesByManager.get(person.id) ?? employeesByManager.get(normalizeName(person.fullName)) ?? [];
    if (team.length > 0) {
      keys.push(nodeKey('manager', `${person.id}:team`));
    }
    return keys;
  };

  const expandAll = () => {
    const keys = new Set<string>();
    for (const root of roots) {
      for (const key of collectKeys(root)) {
        keys.add(key);
      }
    }
    setExpanded(keys);
  };

  const collapseAll = () => setExpanded(new Set());

  const supervisorLabel = (person: TeamManagement) => {
    const supervisorId = resolveSupervisorId(person, byId, byName);
    if (supervisorId) {
      return byId.get(supervisorId)?.fullName ?? person.supervisorFullName ?? person.supervisorName;
    }
    return person.supervisorFullName ?? person.supervisorName;
  };

  const subtreeCounts = useMemo(() => {
    const cache = new Map<string, { direct: number; total: number }>();
    const teamForPerson = (person: TeamManagement) =>
      employeesByManager.get(person.id) ??
      employeesByManager.get(normalizeName(person.fullName)) ??
      [];

    const countFor = (personId: string): { direct: number; total: number } => {
      const cached = cache.get(personId);
      if (cached) return cached;

      const person = byId.get(personId);
      const reports = childrenBySupervisor.get(personId) ?? [];
      const team = person ? teamForPerson(person) : [];
      const direct = reports.length + team.length;
      let total = direct;
      for (const child of reports) {
        total += countFor(child.id).total;
      }
      const result = { direct, total };
      cache.set(personId, result);
      return result;
    };

    for (const person of management) {
      countFor(person.id);
    }
    return cache;
  }, [management, byId, childrenBySupervisor, employeesByManager]);

  const teamFor = (person: TeamManagement) =>
    employeesByManager.get(person.id) ?? employeesByManager.get(normalizeName(person.fullName)) ?? [];

  const renderEmployee = (member: TeamRosterMember, depth: number) => (
    <TreeRow
      key={member.id}
      depth={depth}
      expanded={false}
      hasChildren={false}
      onToggle={() => {}}
      icon={<Users size={16} />}
      label={member.fullName}
      meta={member.designationCode ?? member.designation}
    />
  );

  const renderManager = (person: TeamManagement, depth: number) => {
    const key = nodeKey('manager', person.id);
    const teamKey = nodeKey('manager', `${person.id}:team`);
    const reports = childrenBySupervisor.get(person.id) ?? [];
    const team = teamFor(person);
    const hasChildren = reports.length > 0 || team.length > 0;
    const isExpanded = expanded.has(key);
    const supervisor = supervisorLabel(person);
    const hasUnresolvedSupervisor =
      !!(person.supervisorName ?? person.supervisorFullName) &&
      !resolveSupervisorId(person, byId, byName);
    const counts = subtreeCounts.get(person.id) ?? { direct: 0, total: 0 };
    const countLabel =
      counts.total > 0
        ? counts.total === counts.direct
          ? `(${counts.direct})`
          : `(${counts.direct} · ${counts.total})`
        : undefined;

    return (
      <div key={person.id}>
        <TreeRow
          depth={depth}
          expanded={isExpanded}
          hasChildren={hasChildren}
          onToggle={() => toggle(key)}
          icon={<UserCircle size={16} />}
          label={person.fullName}
          meta={[person.roleTitle, countLabel].filter(Boolean).join(' ')}
          subMeta={supervisor ? `Supervisor: ${supervisor}` : undefined}
          warning={hasUnresolvedSupervisor ? 'Supervisor name not linked' : undefined}
          selected={selectedId === person.id}
          onLabelClick={canEdit ? () => onSelect?.(person) : undefined}
        />
        {isExpanded && (
          <>
            {reports.map((child) => renderManager(child, depth + 1))}
            {team.length > 0 && (
              <div>
                <TreeRow
                  depth={depth + 1}
                  expanded={expanded.has(teamKey)}
                  hasChildren={team.length > 0}
                  onToggle={() => toggle(teamKey)}
                  icon={<Users size={16} />}
                  label="Team roster"
                  meta={`(${team.length})`}
                />
                {expanded.has(teamKey) && team.map((member) => renderEmployee(member, depth + 2))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return <p className="text-text2">Loading management hierarchy…</p>;
  }

  if (management.length === 0) {
    return (
      <p className="text-text2">
        No management roster yet. Add people under Admin → Management.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <button type="button" onClick={expandAll} className="text-accent hover:underline">
          Expand all
        </button>
        <span className="text-text2">·</span>
        <button type="button" onClick={collapseAll} className="text-accent hover:underline">
          Collapse all
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-bg2/30">
        {roots.map((root) => renderManager(root, 0))}
      </div>
    </div>
  );
}
