import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SlideOverListPanel } from '@/components/SlideOverListPanel';
import type { Capacity, Allocation } from '@/types';
import type { WorkCategory } from '@/api/lookup.api';
import type { SlideOverEntry, SlideOverGroup } from '@/utils/breakdownProjects';
import {
  allocationFunctionalUnitLabel,
  allocationTaskLabel,
  formatAllocationDateRange,
} from '@/utils/allocationUi';
import {
  buildAllocationSummary,
  buildWorkCategoryTrees,
  compareByPriority,
  formatFte,
  formatPersonDays,
  type AllocationSummaryFilters,
  type ManagerAllocationSummary,
  type ProjectAllocationSummary,
  type SummaryPerson,
  type WorkCategoryManagerNode,
} from '@/utils/allocationSummary';

type DrillPanel = {
  title: string;
  subtitle: string;
  items?: SlideOverEntry[];
  groups?: SlideOverGroup[];
  defaultExpanded?: boolean;
};

function allocationEntry(allocation: Allocation): SlideOverEntry {
  const extras = [
    allocation.workCategoryName?.trim(),
    formatAllocationDateRange(allocation),
    allocation.taskTypeName,
    allocation.taskCategoryName,
  ].filter(Boolean);
  return {
    label: `${allocation.percentage}% · ${allocationTaskLabel(allocation)}`,
    meta: extras.join(' · '),
  };
}

function projectAllocationGroups(allocations: Allocation[]): SlideOverGroup[] {
  const byPerson = new Map<string, Allocation[]>();
  for (const allocation of allocations) {
    const list = byPerson.get(allocation.employeeId) ?? [];
    list.push(allocation);
    byPerson.set(allocation.employeeId, list);
  }
  return [...byPerson.values()]
    .map((list) => {
      const name = list[0]?.employeeName ?? 'Unknown';
      const sorted = [...list].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
      return {
        title: `${name} (${sorted.length})`,
        items: sorted.map(allocationEntry),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}

function personAllocationGroups(allocations: Allocation[]): SlideOverGroup[] {
  const byProject = new Map<string, Allocation[]>();
  for (const allocation of allocations) {
    const key = allocation.projectId || allocation.projectName || 'Unassigned';
    const list = byProject.get(key) ?? [];
    list.push(allocation);
    byProject.set(key, list);
  }
  return [...byProject.values()]
    .map((list) => {
      const name = list[0]?.projectName?.trim() || 'Unassigned project';
      const sorted = [...list].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
      return {
        title: `${name} (${sorted.length})`,
        items: sorted.map(allocationEntry),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
}

type HeadcountRole = 'architects' | 'developers' | 'qas';

const HEADCOUNT_TONE = 'bg-slate-500/15';

const HEADCOUNT_ROLES: { key: HeadcountRole; label: string }[] = [
  { key: 'architects', label: 'Architects' },
  { key: 'developers', label: 'Developers' },
  { key: 'qas', label: 'QAs' },
];

function emptyHeadcount(): Record<HeadcountRole, SummaryPerson[]> {
  return { architects: [], developers: [], qas: [] };
}

/** Allocated people are architects, QAs, or developers. Managers are assigned on the functional unit. */
function headcountRole(designation?: string): HeadcountRole {
  const name = (designation ?? '').toLowerCase();
  if (name.includes('architect')) return 'architects';
  if (
    /\bqa\b/.test(name) ||
    name.includes('quality') ||
    name.includes('sdet') ||
    name.includes('test engineer')
  ) {
    return 'qas';
  }
  return 'developers';
}

function assignedManagerPerson(manager: { id: string; name: string; roleTitle?: string }): SummaryPerson {
  return {
    employeeId: manager.id,
    employeeName: manager.name,
    designationName: manager.roleTitle,
    engineeringManagerName: manager.name,
    allocatedPct: 0,
    availablePct: 100,
    fte: 0,
    personDays: 0,
    allocations: [],
  };
}

function personEntry(person: SummaryPerson): SlideOverEntry {
  const status = person.fte > 0 ? `${person.allocatedPct}% allocated` : 'Not allocated';
  return {
    label: person.employeeName,
    meta: `${status} · ${formatFte(person.fte)} FTE${
      person.designationName ? ` · ${person.designationName}` : ''
    }`,
  };
}

/** Managers are the assigned engineering managers. Everyone else is grouped by designation. */
function roleGroups(people: SummaryPerson[], managers: SummaryPerson[]): SlideOverGroup[] {
  const managerIds = new Set(managers.map((person) => person.employeeId));
  const managerNames = new Set(managers.map((person) => person.employeeName.trim().toLowerCase()));
  const buckets = emptyHeadcount();
  const managerPeople: SummaryPerson[] = [];
  for (const person of people) {
    const isManager =
      managerIds.has(person.employeeId) || managerNames.has(person.employeeName.trim().toLowerCase());
    if (isManager) managerPeople.push(person);
    else buckets[headcountRole(person.designationName)].push(person);
  }
  return [
    { title: 'Managers', people: managerPeople },
    { title: 'Architects', people: buckets.architects },
    { title: 'Developers', people: buckets.developers },
    { title: 'QAs', people: buckets.qas },
  ]
    .filter((group) => group.people.length > 0)
    .map((group) => ({ title: group.title, items: group.people.map(personEntry) }));
}

function engineerAllocationGroups(people: SummaryPerson[]): SlideOverGroup[] {
  const allocated = people
    .filter((person) => person.allocations.length > 0)
    .slice()
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }));
  const unallocated = people.filter((person) => person.allocations.length === 0);
  const groups: SlideOverGroup[] = [];
  if (allocated.length > 0) {
    groups.push({
      title: `Allocated (${allocated.length})`,
      items: allocated.flatMap((person) =>
        [...person.allocations]
          .sort(
            (a, b) =>
              allocationFunctionalUnitLabel(a).localeCompare(allocationFunctionalUnitLabel(b), undefined, {
                sensitivity: 'base',
              }) || a.fromDate.localeCompare(b.fromDate),
          )
          .map((allocation) => ({
            label: person.employeeName,
            meta: [
              allocationFunctionalUnitLabel(allocation),
              allocationTaskLabel(allocation),
              `${allocation.percentage}%`,
              person.designationName,
              formatAllocationDateRange(allocation),
            ]
              .filter(Boolean)
              .join(' · '),
          })),
      ),
    });
  }
  if (unallocated.length > 0) {
    groups.push({
      title: `Not allocated (${unallocated.length})`,
      items: unallocated.map(personEntry),
    });
  }
  return groups;
}

function toggleSet(current: Set<string>, key: string): Set<string> {
  const next = new Set(current);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function ExpandLabel({
  open,
  label,
  onClick,
}: {
  open: boolean;
  label: string;
  onClick: () => void;
}) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 text-left font-medium hover:text-accent"
      aria-expanded={open}
    >
      <Icon size={16} className="shrink-0 text-text2" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function CountButton({
  value,
  onClick,
  plain = false,
}: {
  value: number;
  onClick?: () => void;
  plain?: boolean;
}) {
  const weight = plain ? 'font-normal' : 'font-semibold';
  if (!onClick || value === 0) {
    return <span className={`${weight} tabular-nums`}>{value}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${weight} tabular-nums text-accent hover:underline`}
      title="View details"
    >
      {value}
    </button>
  );
}

function Kpi({
  label,
  value,
  hint,
  onValueClick,
  onHintClick,
}: {
  label: string;
  value: string;
  hint?: string;
  onValueClick?: () => void;
  onHintClick?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text2">{label}</p>
      {onValueClick ? (
        <button
          type="button"
          onClick={onValueClick}
          className="mt-1 text-2xl font-semibold tabular-nums text-accent hover:underline"
          title="View names"
        >
          {value}
        </button>
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      )}
      {hint &&
        (onHintClick ? (
          <button
            type="button"
            onClick={onHintClick}
            className="mt-1 block text-xs text-text2 hover:text-accent hover:underline"
          >
            {hint}
          </button>
        ) : (
          <p className="mt-1 text-xs text-text2">{hint}</p>
        ))}
    </div>
  );
}

function SummaryTable({
  title,
  description,
  headers,
  children,
  empty,
  emptyMessage = 'No allocations in this date range.',
  actions,
}: {
  title: string;
  description: string;
  headers: { label: string; align?: 'left' | 'right'; className?: string }[];
  children: ReactNode;
  empty: boolean;
  emptyMessage?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-text2">{description}</p>
        </div>
        {actions}
      </div>
      <div className="rounded-xl border border-border">
        <div className="max-h-[min(60vh,640px)] overflow-auto">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
              <tr className="whitespace-nowrap">
                {headers.map((header) => (
                  <th
                    key={header.label}
                    className={`${header.align === 'right' ? 'px-3 py-2 text-right' : 'px-3 py-2'} ${header.className ?? ''}`}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
        {empty && <p className="border-t border-border px-4 py-6 text-sm text-text2">{emptyMessage}</p>}
      </div>
    </section>
  );
}

function indentClass(level: 0 | 1 | 2): string {
  if (level === 1) return 'pl-6';
  if (level === 2) return 'pl-11';
  return '';
}

function directorBucket(directors: { id: string; name: string }[] | undefined) {
  const sorted = [...(directors ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
  if (sorted.length === 0) return { key: 'unassigned', label: 'Unassigned' };
  return {
    key: sorted.map((director) => director.id).join('|'),
    label: sorted.map((director) => director.name).join(', '),
  };
}

function groupByDirector<T extends { directors?: { id: string; name: string }[] }>(units: T[]) {
  const buckets: { key: string; label: string; units: T[] }[] = [];
  for (const unit of units) {
    const bucket = directorBucket(unit.directors);
    const existing = buckets.find((item) => item.key === bucket.key);
    if (existing) existing.units.push(unit);
    else buckets.push({ key: bucket.key, label: bucket.label, units: [unit] });
  }
  return buckets;
}

function emptyManagerNode(categoryId: string, managerId: string, managerName: string): WorkCategoryManagerNode {
  return {
    key: `${categoryId}:${managerId}`,
    managerId,
    managerName,
    team: [],
    projects: [],
    teamSize: 0,
    allocatedCount: 0,
    projectCount: 0,
    allocatedFte: 0,
    availableFte: 0,
  };
}

/** Always list the managers assigned to the functional unit, even when nobody is allocated yet. */
function managersForFunctionalUnit(
  tree: { id: string; managers: WorkCategoryManagerNode[] },
  category: WorkCategory | undefined,
): WorkCategoryManagerNode[] {
  const assigned = category?.engineeringManagers ?? [];
  if (assigned.length === 0) return tree.managers;
  const byId = new Map(tree.managers.map((node) => [node.managerId, node]));
  const byName = new Map(
    tree.managers.map((node) => [node.managerName.trim().toLowerCase(), node]),
  );
  const used = new Set<string>();
  const rows = assigned.map((manager) => {
    const existing =
      byId.get(manager.id) ?? byName.get(manager.name.trim().toLowerCase());
    if (!existing) return emptyManagerNode(tree.id, manager.id, manager.name);
    used.add(existing.key);
    return { ...existing, managerId: manager.id, managerName: manager.name };
  });
  for (const node of tree.managers) {
    if (!used.has(node.key)) rows.push(node);
  }
  return rows.sort((a, b) =>
    a.managerName.localeCompare(b.managerName, undefined, { sensitivity: 'base' }),
  );
}

export function ResourceAllocationSummary({
  rows,
  rangeFrom,
  rangeTo,
  filters,
  workCategories = [],
  workCategoryId,
  includeUnassigned = true,
}: {
  rows: Capacity[];
  rangeFrom: string;
  rangeTo: string;
  filters?: AllocationSummaryFilters;
  workCategories?: WorkCategory[];
  workCategoryId?: string;
  includeUnassigned?: boolean;
}) {
  const [drill, setDrill] = useState<DrillPanel | null>(null);
  const [openManagers, setOpenManagers] = useState<Set<string>>(() => new Set());
  const [openCategories, setOpenCategories] = useState<Set<string>>(() => new Set());
  const [openDirectors, setOpenDirectors] = useState<Set<string>>(() => new Set());
  const summary = useMemo(
    () => buildAllocationSummary(rows, rangeFrom, rangeTo, filters),
    [rows, rangeFrom, rangeTo, filters],
  );
  const scopedWorkCategories = useMemo(
    () =>
      [...(workCategoryId
        ? workCategories.filter((category) => category.id === workCategoryId)
        : workCategories)].sort(compareByPriority),
    [workCategories, workCategoryId],
  );
  const categoryTrees = useMemo(
    () =>
      buildWorkCategoryTrees(
        summary.allocatedPeople,
        summary.managers,
        scopedWorkCategories,
        rangeFrom,
        rangeTo,
        { includeUnassigned: includeUnassigned && !workCategoryId },
      ),
    [
      summary.allocatedPeople,
      summary.managers,
      scopedWorkCategories,
      rangeFrom,
      rangeTo,
      workCategoryId,
      includeUnassigned,
    ],
  );
  const categoryComposition = useMemo(() => {
    const categoryNameByUnit = new Map(
      scopedWorkCategories.map((category) => [
        category.id,
        category.functionalUnitCategoryName?.trim() || 'No category',
      ]),
    );
    const categoryById = new Map(scopedWorkCategories.map((category) => [category.id, category]));
    const groups = new Map<
      string,
      {
        id: string;
        name: string;
        managers: { id: string; name: string; roleTitle?: string }[];
        directors: { id: string; name: string }[];
        people: Record<HeadcountRole, SummaryPerson[]>;
      }[]
    >();
    const order: string[] = [];
    for (const tree of categoryTrees) {
      const categoryName = categoryNameByUnit.get(tree.id) || 'No category';
      if (!groups.has(categoryName)) {
        groups.set(categoryName, []);
        order.push(categoryName);
      }
      const people = emptyHeadcount();
      const seen = new Set<string>();
      for (const node of tree.managers) {
        for (const person of node.team) {
          if (seen.has(person.employeeId)) continue;
          seen.add(person.employeeId);
          people[headcountRole(person.designationName)].push(person);
        }
      }
      for (const role of HEADCOUNT_ROLES) {
        people[role.key].sort((a, b) =>
          a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
        );
      }
      const managers = [...(categoryById.get(tree.id)?.engineeringManagers ?? [])].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
      const directors = [...(categoryById.get(tree.id)?.directors ?? [])]
        .map((director) => ({ id: director.id, name: director.name }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      groups.get(categoryName)!.push({ id: tree.id, name: tree.name, managers, directors, people });
    }
    const names = [
      ...order.filter((name) => name !== 'No category'),
      ...order.filter((name) => name === 'No category'),
    ];
    return names.map((name) => ({ name, units: groups.get(name) ?? [] }));
  }, [categoryTrees, scopedWorkCategories]);
  const categoryIds = categoryTrees.map((tree) => tree.id).join('|');
  useEffect(() => {
    setOpenManagers(new Set());
    setOpenCategories(new Set());
    setOpenDirectors(new Set());
  }, [categoryIds]);
  const toggleManager = (key: string) => {
    setOpenManagers((prev) => toggleSet(prev, key));
  };

  const openProjectPeople = (project: ProjectAllocationSummary) => {
    setDrill({
      title: project.projectName,
      subtitle: `${project.peopleCount} people · ${formatFte(project.fte)} FTE · ${rangeFrom} → ${rangeTo}`,
      items: project.people.map(personEntry),
    });
  };

  const openProjectAllocations = (project: ProjectAllocationSummary) => {
    setDrill({
      title: project.projectName,
      subtitle: `${project.allocationCount} allocations · ${project.peopleCount} people · ${formatFte(project.fte)} FTE · ${rangeFrom} → ${rangeTo}`,
      groups: projectAllocationGroups(project.allocations),
      defaultExpanded: true,
    });
  };

  const openPersonAllocations = (person: SummaryPerson) => {
    setDrill({
      title: person.employeeName,
      subtitle: `${person.allocations.length} allocations · ${person.allocatedPct}% · ${formatFte(person.fte)} FTE · ${rangeFrom} → ${rangeTo}`,
      groups: personAllocationGroups(person.allocations),
      defaultExpanded: true,
    });
  };

  const openManagerPeople = (manager: ManagerAllocationSummary) => {
    setDrill({
      title: manager.managerName,
      subtitle: `${manager.allocatedCount} of ${manager.teamSize} allocated · ${formatFte(manager.allocatedFte)} FTE · ${rangeFrom} → ${rangeTo}`,
      groups: engineerAllocationGroups(manager.people),
      defaultExpanded: true,
    });
  };

  const openManagerProjects = (manager: ManagerAllocationSummary) => {
    setDrill({
      title: manager.managerName,
      subtitle: `Projects in ${rangeFrom} → ${rangeTo}`,
      items: manager.projects.map((project) => ({
        label: project.name,
        meta: `${formatFte(project.fte)} FTE`,
      })),
    });
  };

  const openHeadcount = (unitName: string, role: string, people: SummaryPerson[]) => {
    setDrill({
      title: `${unitName} · ${role}`,
      subtitle: `${people.length} people · ${rangeFrom} → ${rangeTo}`,
      items: people.map(personEntry),
    });
  };

  const openTreeManagerPeople = (node: WorkCategoryManagerNode) => {
    setDrill({
      title: node.managerName,
      subtitle: `${node.allocatedCount} people allocated · ${formatFte(node.allocatedFte)} FTE · ${rangeFrom} → ${rangeTo}`,
      groups: engineerAllocationGroups(node.team),
      defaultExpanded: true,
    });
  };

  const openManagerRoster = (node: WorkCategoryManagerNode, people: SummaryPerson[]) => {
    const allocated = people.filter((person) => person.fte > 0);
    const unallocated = people.filter((person) => person.fte <= 0);
    setDrill({
      title: node.managerName,
      subtitle: `${people.length} team members · ${rangeFrom} → ${rangeTo}`,
      groups: [
        { title: `Allocated (${allocated.length})`, items: allocated.map(personEntry) },
        { title: `Not allocated (${unallocated.length})`, items: unallocated.map(personEntry) },
      ].filter((group) => group.items.length > 0),
      defaultExpanded: true,
    });
  };

  const openTeamMembers = () => {
    setDrill({
      title: 'Team members',
      subtitle: `${summary.totals.teamSize} people · ${rangeFrom} → ${rangeTo}`,
      groups: [
        {
          title: `Allocated (${summary.allocatedPeople.length})`,
          items: summary.allocatedPeople.map(personEntry),
        },
        {
          title: `Not allocated (${summary.unallocatedPeople.length})`,
          items: summary.unallocatedPeople.map(personEntry),
        },
      ].filter((group) => group.items.length > 0),
      defaultExpanded: true,
    });
  };

  const openAllocatedPeople = () => {
    setDrill({
      title: 'People allocated',
      subtitle: `${summary.totals.allocatedCount} people · ${rangeFrom} → ${rangeTo}`,
      items: summary.allocatedPeople.map(personEntry),
    });
  };

  const openUnallocatedPeople = () => {
    setDrill({
      title: 'Not allocated',
      subtitle: `${summary.totals.unallocatedCount} people · ${rangeFrom} → ${rangeTo}`,
      items: summary.unallocatedPeople.map(personEntry),
    });
  };

  const cell = 'whitespace-nowrap px-3 py-2';
  const treeCell = 'px-3 py-2';
  const rosterFor = (node: WorkCategoryManagerNode): SummaryPerson[] => {
    const name = node.managerName.trim().toLowerCase();
    const named = summary.managers.find((manager) => manager.managerName.trim().toLowerCase() === name);
    if (named && named.people.length > 0) return named.people;
    const byId = summary.managers.find((manager) =>
      manager.people.some((person) => person.engineeringManagerManagementId === node.managerId),
    );
    if (byId && byId.people.length > 0) return byId.people;
    return node.team;
  };
  const visibleManagerRows = (node: WorkCategoryManagerNode) => {
    if (!openManagers.has(node.key)) return 1;
    return 1 + Math.max(rosterFor(node).length, 1);
  };
  const compositionManagers = categoryComposition.flatMap((group) =>
    group.units.flatMap((unit) => {
      const tree = categoryTrees.find((item) => item.id === unit.id);
      if (!tree) return [];
      return managersForFunctionalUnit(
        tree,
        scopedWorkCategories.find((category) => category.id === unit.id),
      );
    }),
  );
  const byPersonName = (a: SummaryPerson, b: SummaryPerson) =>
    a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' });
  type OverviewUnit = (typeof categoryComposition)[number]['units'][number];
  const buildOverview = (units: OverviewUnit[]) => {
    const teamById = new Map<string, SummaryPerson>();
    const allocatedIds = new Set<string>();
    const seenManagers = new Set<string>();
    for (const unit of units) {
      const tree = categoryTrees.find((item) => item.id === unit.id);
      const nodes = tree
        ? managersForFunctionalUnit(
            tree,
            scopedWorkCategories.find((category) => category.id === unit.id),
          )
        : [];
      for (const node of nodes) {
        for (const person of node.team) {
          if (person.fte > 0) allocatedIds.add(person.employeeId);
          if (!teamById.has(person.employeeId)) teamById.set(person.employeeId, person);
        }
        const managerKey = node.managerId || node.managerName.trim().toLowerCase();
        if (seenManagers.has(managerKey)) continue;
        seenManagers.add(managerKey);
        for (const person of rosterFor(node)) {
          if (!teamById.has(person.employeeId)) teamById.set(person.employeeId, person);
        }
      }
    }
    const assignedManagers = new Map<string, { id: string; name: string; roleTitle?: string }>();
    for (const unit of units) {
      for (const manager of unit.managers) {
        if (!assignedManagers.has(manager.id)) assignedManagers.set(manager.id, manager);
      }
    }
    const matchesAssignedManager = (person: SummaryPerson) =>
      assignedManagers.has(person.employeeId) ||
      [...assignedManagers.values()].some(
        (manager) => manager.name.trim().toLowerCase() === person.employeeName.trim().toLowerCase(),
      );
    for (const manager of assignedManagers.values()) {
      const alreadyOnTeam = [...teamById.values()].some(
        (person) =>
          person.employeeId === manager.id ||
          person.employeeName.trim().toLowerCase() === manager.name.trim().toLowerCase(),
      );
      if (!alreadyOnTeam) teamById.set(manager.id, assignedManagerPerson(manager));
    }
    const team = [...teamById.values()].sort(byPersonName);
    const managers = team.filter(matchesAssignedManager);
    const engineers = team.filter((person) => !matchesAssignedManager(person));
    const allocated = team.filter((person) => allocatedIds.has(person.employeeId));
    const notAllocated = engineers.filter((person) => !allocatedIds.has(person.employeeId));
    const managerCount = units.reduce((sum, unit) => sum + unit.managers.length, 0);
    const roleCounts = {
      architects: 0,
      developers: 0,
      qas: 0,
    } satisfies Record<HeadcountRole, number>;
    for (const unit of units) {
      for (const role of HEADCOUNT_ROLES) roleCounts[role.key] += unit.people[role.key].length;
    }
    const total = HEADCOUNT_ROLES.reduce((sum, role) => sum + roleCounts[role.key], 0);
    return { units, team, managers, engineers, allocated, notAllocated, managerCount, roleCounts, total };
  };
  const categoryOverview = categoryComposition.map((group) => ({
    name: group.name,
    ...buildOverview(group.units),
    unitRows: group.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      directors: unit.directors,
      ...buildOverview([unit]),
    })),
  }));
  const overviewCountCells = (
    row: ReturnType<typeof buildOverview> & { name: string },
    functionalUnitCount?: number,
    shaded = true,
  ) => (
    <>
      <td className={`${cell} text-right`}>
        {functionalUnitCount == null ? null : (
          <CountButton
            plain
            value={functionalUnitCount}
            onClick={() =>
              setDrill({
                title: `${row.name} · Functional units`,
                subtitle: `${functionalUnitCount} functional units`,
                items: row.units.map((unit) => unit.name),
              })
            }
          />
        )}
      </td>
      <td className={`${cell} text-right`}>
        <CountButton
          plain
          value={row.team.length}
          onClick={() =>
            setDrill({
              title: `${row.name} · Team`,
              subtitle: `${row.team.length} people · ${rangeFrom} → ${rangeTo}`,
              groups: roleGroups(row.team, row.managers),
            })
          }
        />
      </td>
      <td className={`${cell} text-right`}>
        <CountButton
          plain
          value={row.managers.length}
          onClick={() =>
            setDrill({
              title: `${row.name} · Managers`,
              subtitle: `${row.managers.length} engineering managers · ${rangeFrom} → ${rangeTo}`,
              items: row.managers.map(personEntry),
            })
          }
        />
      </td>
      <td className={`${cell} text-right`}>
        <CountButton
          plain
          value={row.engineers.length}
          onClick={() =>
            setDrill({
              title: `${row.name} · Engineers`,
              subtitle: `${row.engineers.length} people · ${rangeFrom} → ${rangeTo}`,
              groups: roleGroups(row.engineers, row.managers),
            })
          }
        />
      </td>
      <td className={`${cell} text-right`}>
        <CountButton
          plain
          value={row.allocated.length}
          onClick={() =>
            setDrill({
              title: `${row.name} · Allocated`,
              subtitle: `${row.allocated.length} people · ${rangeFrom} → ${rangeTo}`,
              groups: roleGroups(row.allocated, row.managers),
            })
          }
        />
      </td>
      <td className={`${cell} text-right`}>
        <CountButton
          plain
          value={row.notAllocated.length}
          onClick={() =>
            setDrill({
              title: `${row.name} · Not allocated`,
              subtitle: `${row.notAllocated.length} people · ${rangeFrom} → ${rangeTo}`,
              groups: roleGroups(row.notAllocated, row.managers),
            })
          }
        />
      </td>
      {HEADCOUNT_ROLES.map((role) => (
        <td key={role.key} className={`${cell} text-right ${shaded ? HEADCOUNT_TONE : ''}`}>
          <CountButton
            plain
            value={row.roleCounts[role.key]}
            onClick={() =>
              setDrill({
                title: `${row.name} · ${role.label}`,
                subtitle: `${row.roleCounts[role.key]} people · ${rangeFrom} → ${rangeTo}`,
                groups: row.units
                  .filter((unit) => unit.people[role.key].length > 0)
                  .map((unit) => ({
                    title: `${unit.name} (${unit.people[role.key].length})`,
                    items: unit.people[role.key].map(personEntry),
                  })),
              })
            }
          />
        </td>
      ))}
      <td className={`${cell} text-right tabular-nums ${shaded ? HEADCOUNT_TONE : ''}`}>{row.total}</td>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Team members"
          value={String(summary.totals.teamSize)}
          onValueClick={summary.totals.teamSize > 0 ? openTeamMembers : undefined}
        />
        <Kpi
          label="People allocated"
          value={String(summary.totals.allocatedCount)}
          onValueClick={summary.totals.allocatedCount > 0 ? openAllocatedPeople : undefined}
        />
        <Kpi
          label="Not allocated"
          value={String(summary.totals.unallocatedCount)}
          onValueClick={summary.totals.unallocatedCount > 0 ? openUnallocatedPeople : undefined}
        />
      </div>

      <SummaryTable
        title="Functional unit categories"
        description="Team is the managers assigned to the category plus the engineers on their rosters. Not allocated is engineers minus the people allocated on those units."
        headers={[
          { label: 'Functional unit category' },
          { label: '# Functional units', align: 'right' },
          { label: 'Team', align: 'right' },
          { label: 'Managers', align: 'right' },
          { label: 'Engineers', align: 'right' },
          { label: 'Allocated', align: 'right' },
          { label: 'Not allocated', align: 'right' },
          { label: 'Number of Architects', align: 'right', className: HEADCOUNT_TONE },
          { label: 'Developers', align: 'right', className: HEADCOUNT_TONE },
          { label: 'QAs', align: 'right', className: HEADCOUNT_TONE },
          { label: 'Total', align: 'right', className: HEADCOUNT_TONE },
        ]}
        empty={categoryOverview.length === 0}
        emptyMessage="No functional unit categories."
      >
        {categoryOverview.map((group) => {
          const open = openCategories.has(group.name);
          const directorGroups = groupByDirector(group.units);
          const unitRowById = new Map(group.unitRows.map((row) => [row.id, row]));
          return (
            <Fragment key={group.name}>
              <tr className="border-t border-border bg-bg2 hover:bg-bg2">
                <td className={`${cell} font-semibold`}>
                  <ExpandLabel
                    open={open}
                    label={group.name}
                    onClick={() => setOpenCategories((prev) => toggleSet(prev, group.name))}
                  />
                </td>
                {overviewCountCells(group, group.units.length)}
              </tr>
              {open &&
                directorGroups.map((director) => {
                  const directorKey = `${group.name}:${director.key}`;
                  const directorOpen = openDirectors.has(directorKey);
                  const directorRow = {
                    name: director.label,
                    ...buildOverview(director.units),
                  };
                  return (
                    <Fragment key={directorKey}>
                      <tr className="border-t border-border bg-bg hover:bg-bg2/40">
                        <td className={`${treeCell} ${indentClass(1)} text-sm font-medium`}>
                          <ExpandLabel
                            open={directorOpen}
                            label={director.label}
                            onClick={() => setOpenDirectors((prev) => toggleSet(prev, directorKey))}
                          />
                        </td>
                        {overviewCountCells(directorRow, director.units.length, false)}
                      </tr>
                      {directorOpen &&
                        director.units.map((unit) => {
                          const row = unitRowById.get(unit.id);
                          if (!row) return null;
                          return (
                            <tr key={unit.id} className="border-t border-border bg-bg text-xs hover:bg-bg2/30">
                              <td className={`${treeCell} ${indentClass(2)} text-sm`}>{unit.name}</td>
                              {overviewCountCells(row, undefined, false)}
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })}
            </Fragment>
          );
        })}
        {categoryOverview.length > 0 && (
          <tr className="border-t border-border bg-bg2">
            <td className={`${cell} font-semibold`}>Total</td>
            <td className={`${cell} text-right tabular-nums`}>
              {categoryOverview.reduce((sum, group) => sum + group.units.length, 0)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {categoryOverview.reduce((sum, group) => sum + group.team.length, 0)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {categoryOverview.reduce((sum, group) => sum + group.managers.length, 0)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {categoryOverview.reduce((sum, group) => sum + group.engineers.length, 0)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {categoryOverview.reduce((sum, group) => sum + group.allocated.length, 0)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {categoryOverview.reduce((sum, group) => sum + group.notAllocated.length, 0)}
            </td>
            {HEADCOUNT_ROLES.map((role) => (
              <td key={role.key} className={`${cell} text-right tabular-nums ${HEADCOUNT_TONE}`}>
                {categoryOverview.reduce((sum, group) => sum + group.roleCounts[role.key], 0)}
              </td>
            ))}
            <td className={`${cell} text-right tabular-nums ${HEADCOUNT_TONE}`}>
              {categoryOverview.reduce((sum, group) => sum + group.total, 0)}
            </td>
          </tr>
        )}
      </SummaryTable>

      <SummaryTable
        title="By functional unit category"
        description="Team is the manager’s full roster. Allocated is the people with an allocation on that functional unit. Not allocated is the rest of that team."
        headers={[
          { label: 'Functional unit category' },
          { label: 'Director / VP' },
          { label: 'Priority', align: 'right' },
          { label: 'Functional unit' },
          { label: 'Manager' },
          { label: 'Team', align: 'right' },
          { label: 'Allocated', align: 'right' },
          { label: 'Not allocated', align: 'right' },
          { label: 'Architects', align: 'right', className: HEADCOUNT_TONE },
          { label: 'Developers', align: 'right', className: HEADCOUNT_TONE },
          { label: 'QAs', align: 'right', className: HEADCOUNT_TONE },
          { label: 'Total', align: 'right', className: HEADCOUNT_TONE },
        ]}
        empty={categoryComposition.length === 0}
        emptyMessage="No functional units."
      >
        {categoryComposition.flatMap((group) => {
          const units = group.units.map((unit) => {
            const tree = categoryTrees.find((item) => item.id === unit.id);
            const managers = tree
              ? managersForFunctionalUnit(
                  tree,
                  scopedWorkCategories.find((category) => category.id === unit.id),
                )
              : [];
            const span =
              managers.length === 0
                ? 1
                : managers.reduce((sum, node) => sum + visibleManagerRows(node), 0);
            return { unit, tree, managers, span };
          });
          const groupSpan = units.reduce((sum, item) => sum + item.span, 0);
          const directorGroups = groupByDirector(units.map((item) => item.unit)).map((bucket) => ({
            ...bucket,
            units: bucket.units.map((unit) => units.find((item) => item.unit.id === unit.id)!),
          }));
          return directorGroups.flatMap((director, directorIndex) => {
            const directorSpan = director.units.reduce((sum, item) => sum + item.span, 0);
            return director.units.flatMap(({ unit, tree, managers, span }, unitIndex) => {
            const total = HEADCOUNT_ROLES.reduce((sum, role) => sum + unit.people[role.key].length, 0);
            const categoryCell = directorIndex === 0 && unitIndex === 0 && (
              <td rowSpan={groupSpan} className={`${treeCell} align-top font-semibold`}>
                {group.name}
              </td>
            );
            const directorCell = unitIndex === 0 && (
              <td rowSpan={directorSpan} className={`${treeCell} align-top`}>
                {director.label}
              </td>
            );
            const unitCells = (
              <>
                <td rowSpan={span} className={`${cell} align-top text-right tabular-nums text-text2`}>
                  {tree?.sortOrder != null ? tree.sortOrder : '—'}
                </td>
                <td rowSpan={span} className={`${treeCell} align-top font-semibold`}>
                  {unit.name}
                </td>
              </>
            );
            const roleCells = (
              <>
                {HEADCOUNT_ROLES.map((role) => (
                  <td key={role.key} rowSpan={span} className={`${cell} align-top text-right ${HEADCOUNT_TONE}`}>
                    <CountButton
                      value={unit.people[role.key].length}
                      onClick={() => openHeadcount(unit.name, role.label, unit.people[role.key])}
                    />
                  </td>
                ))}
                <td rowSpan={span} className={`${cell} align-top text-right font-semibold tabular-nums ${HEADCOUNT_TONE}`}>
                  {total}
                </td>
              </>
            );
            if (managers.length === 0) {
              return [
                <tr key={unit.id} className="border-t border-border hover:bg-bg2/50">
                  {categoryCell}
                  {directorCell}
                  {unitCells}
                  <td className={`${treeCell} text-text2`}>No engineering managers assigned.</td>
                  <td className={`${cell} text-right tabular-nums`}>0</td>
                  <td className={`${cell} text-right tabular-nums`}>0</td>
                  <td className={`${cell} text-right tabular-nums`}>0</td>
                  {roleCells}
                </tr>,
              ];
            }
            return managers.flatMap((node, managerIndex) => {
              const managerOpen = openManagers.has(node.key);
              const roster = rosterFor(node);
              const allocatedIds = new Set(node.team.map((person) => person.employeeId));
              const notAllocated = roster.filter((person) => !allocatedIds.has(person.employeeId));
              const rows = [
                <tr key={node.key} className="border-t border-border hover:bg-bg2/50">
                  {managerIndex === 0 && categoryCell}
                  {managerIndex === 0 && directorCell}
                  {managerIndex === 0 && unitCells}
                  <td className={`${treeCell} font-medium`}>
                    <ExpandLabel
                      open={managerOpen}
                      label={node.managerName}
                      onClick={() => toggleManager(node.key)}
                    />
                  </td>
                  <td className={`${cell} text-right`}>
                    <CountButton value={roster.length} onClick={() => openManagerRoster(node, roster)} />
                  </td>
                  <td className={`${cell} text-right`}>
                    <CountButton value={node.allocatedCount} onClick={() => openTreeManagerPeople(node)} />
                  </td>
                  <td className={`${cell} text-right`}>
                    <CountButton
                      value={notAllocated.length}
                      onClick={() =>
                        setDrill({
                          title: `${node.managerName} · Not allocated`,
                          subtitle: `${notAllocated.length} people · ${unit.name} · ${rangeFrom} → ${rangeTo}`,
                          items: notAllocated.map(personEntry),
                        })
                      }
                    />
                  </td>
                  {managerIndex === 0 && roleCells}
                </tr>,
              ];
              if (!managerOpen) return rows;
              if (roster.length === 0) {
                rows.push(
                  <tr key={`${node.key}:empty`} className="border-t border-border">
                    <td className={`${treeCell} ${indentClass(1)} text-text2`}>
                      No people on this team.
                    </td>
                    <td className={cell} />
                    <td className={cell} />
                    <td className={cell} />
                  </tr>,
                );
                return rows;
              }
              for (const person of roster) {
                const allocatedHere = allocatedIds.has(person.employeeId);
                const scoped = node.team.find((member) => member.employeeId === person.employeeId) ?? person;
                rows.push(
                  <tr key={`${node.key}:${person.employeeId}`} className="border-t border-border hover:bg-bg2/30">
                    <td className={`${treeCell} ${indentClass(1)}`}>
                      {allocatedHere ? (
                        <button
                          type="button"
                          onClick={() => openPersonAllocations(scoped)}
                          className="text-left text-accent hover:underline"
                        >
                          {person.employeeName}
                        </button>
                      ) : (
                        person.employeeName
                      )}
                      {person.designationName ? (
                        <span className="ml-2 text-xs text-text2">{person.designationName}</span>
                      ) : null}
                    </td>
                    <td className={`${cell} text-right tabular-nums text-text2`}>1</td>
                    <td className={`${cell} text-right tabular-nums`}>{allocatedHere ? 1 : 0}</td>
                    <td className={`${cell} text-right tabular-nums`}>{allocatedHere ? 0 : 1}</td>
                  </tr>,
                );
              }
              return rows;
            });
            });
          });
        })}
        {categoryComposition.length > 0 && (
          <tr className="border-t border-border bg-bg2 font-semibold">
            <td className={cell} colSpan={5}>
              Total
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {(() => {
                const seen = new Set<string>();
                return compositionManagers.reduce((sum, node) => {
                  const key = node.managerId || node.managerName.trim().toLowerCase();
                  if (seen.has(key)) return sum;
                  seen.add(key);
                  return sum + rosterFor(node).length;
                }, 0);
              })()}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {compositionManagers.reduce((sum, node) => sum + node.allocatedCount, 0)}
            </td>
            <td className={`${cell} text-right tabular-nums`}>
              {compositionManagers.reduce((sum, node) => {
                const roster = rosterFor(node);
                const allocatedIds = new Set(node.team.map((person) => person.employeeId));
                return sum + roster.filter((person) => !allocatedIds.has(person.employeeId)).length;
              }, 0)}
            </td>
            {HEADCOUNT_ROLES.map((role) => (
              <td key={role.key} className={`${cell} text-right tabular-nums ${HEADCOUNT_TONE}`}>
                {categoryComposition.reduce(
                  (sum, group) =>
                    sum + group.units.reduce((unitSum, unit) => unitSum + unit.people[role.key].length, 0),
                  0,
                )}
              </td>
            ))}
            <td className={`${cell} text-right tabular-nums ${HEADCOUNT_TONE}`}>
              {categoryComposition.reduce(
                (sum, group) =>
                  sum +
                  group.units.reduce(
                    (unitSum, unit) =>
                      unitSum +
                      HEADCOUNT_ROLES.reduce((roleSum, role) => roleSum + unit.people[role.key].length, 0),
                    0,
                  ),
                0,
              )}
            </td>
          </tr>
        )}
      </SummaryTable>

      <div className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="By project"
          description="Duration-weighted allocation across the selected From–To dates."
          headers={[
            { label: '#' },
            { label: 'Project' },
            { label: 'People', align: 'right' },
            { label: 'Allocations', align: 'right' },
            { label: 'Avg %', align: 'right' },
            { label: 'FTE', align: 'right' },
            { label: 'Person-days', align: 'right' },
          ]}
          empty={summary.projects.length === 0}
        >
          {summary.projects.map((project, index) => (
            <tr key={project.key} className="border-t border-border hover:bg-bg2/50">
              <td className={`${cell} text-xs tabular-nums text-text2`}>{index + 1}</td>
              <td className={`${cell} font-medium`} title={project.projectName}>
                <button
                  type="button"
                  onClick={() => openProjectAllocations(project)}
                  className="text-left font-medium text-accent hover:underline"
                >
                  {project.projectName}
                </button>
              </td>
              <td className={`${cell} text-right`}>
                <CountButton value={project.peopleCount} onClick={() => openProjectPeople(project)} />
              </td>
              <td className={`${cell} text-right`}>
                <CountButton
                  value={project.allocationCount}
                  onClick={() => openProjectAllocations(project)}
                />
              </td>
              <td className={`${cell} text-right tabular-nums`}>{project.avgPct}%</td>
              <td className={`${cell} text-right tabular-nums`}>{formatFte(project.fte)}</td>
              <td className={`${cell} text-right tabular-nums`}>
                {formatPersonDays(project.personDays)}
              </td>
            </tr>
          ))}
        </SummaryTable>

        <SummaryTable
          title="By manager team"
          description="Engineering / Delivery / COE manager teams for the selected From–To dates."
          headers={[
            { label: '#' },
            { label: 'Manager' },
            { label: 'Team', align: 'right' },
            { label: 'Allocated', align: 'right' },
            { label: 'Projects', align: 'right' },
            { label: 'Avg %', align: 'right' },
            { label: 'FTE', align: 'right' },
            { label: 'Available FTE', align: 'right' },
          ]}
          empty={summary.managers.length === 0}
        >
          {summary.managers.map((manager, index) => (
            <tr key={manager.key} className="border-t border-border hover:bg-bg2/50">
              <td className={`${cell} text-xs tabular-nums text-text2`}>{index + 1}</td>
              <td className={`${cell} font-medium`} title={manager.managerName}>
                {manager.managerName}
              </td>
              <td className={`${cell} text-right`}>
                <CountButton value={manager.teamSize} onClick={() => openManagerPeople(manager)} />
              </td>
              <td className={`${cell} text-right`}>
                <CountButton
                  value={manager.allocatedCount}
                  onClick={() => openManagerPeople(manager)}
                />
              </td>
              <td className={`${cell} text-right`}>
                <CountButton
                  value={manager.projectCount}
                  onClick={() => openManagerProjects(manager)}
                />
              </td>
              <td className={`${cell} text-right tabular-nums`}>{manager.avgPct}%</td>
              <td className={`${cell} text-right tabular-nums`}>
                {formatFte(manager.allocatedFte)}
              </td>
              <td className={`${cell} text-right tabular-nums`}>
                {formatFte(manager.availableFte)}
              </td>
            </tr>
          ))}
        </SummaryTable>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <SummaryTable
          title="Allocated"
          description="People with allocation in the selected From–To dates."
          headers={[
            { label: '#' },
            { label: 'Name' },
            { label: 'Designation' },
            { label: 'Manager' },
            { label: 'Avg %', align: 'right' },
            { label: 'FTE', align: 'right' },
            { label: 'Person-days', align: 'right' },
          ]}
          empty={summary.allocatedPeople.length === 0}
          emptyMessage="No allocated people in this date range."
        >
          {summary.allocatedPeople.map((person, index) => (
            <tr key={person.employeeId} className="border-t border-border hover:bg-bg2/50">
              <td className={`${cell} text-xs tabular-nums text-text2`}>{index + 1}</td>
              <td className={`${cell} font-medium`}>
                <button
                  type="button"
                  onClick={() => openPersonAllocations(person)}
                  className="text-left font-medium text-accent hover:underline"
                >
                  {person.employeeName}
                </button>
              </td>
              <td className={`${cell} text-text2`}>{person.designationName ?? '—'}</td>
              <td className={`${cell} text-text2`}>{person.engineeringManagerName}</td>
              <td className={`${cell} text-right tabular-nums`}>{person.allocatedPct}%</td>
              <td className={`${cell} text-right tabular-nums`}>{formatFte(person.fte)}</td>
              <td className={`${cell} text-right tabular-nums`}>
                {formatPersonDays(person.personDays)}
              </td>
            </tr>
          ))}
        </SummaryTable>

        <SummaryTable
          title="Not allocated"
          description="People with no allocation in the selected From–To dates."
          headers={[
            { label: '#' },
            { label: 'Name' },
            { label: 'Designation' },
            { label: 'Manager' },
            { label: 'Available %', align: 'right' },
            { label: 'Available FTE', align: 'right' },
          ]}
          empty={summary.unallocatedPeople.length === 0}
          emptyMessage="Everyone in scope has some allocation in this date range."
        >
          {summary.unallocatedPeople.map((person, index) => (
            <tr key={person.employeeId} className="border-t border-border hover:bg-bg2/50">
              <td className={`${cell} text-xs tabular-nums text-text2`}>{index + 1}</td>
              <td className={`${cell} font-medium`}>{person.employeeName}</td>
              <td className={`${cell} text-text2`}>{person.designationName ?? '—'}</td>
              <td className={`${cell} text-text2`}>{person.engineeringManagerName}</td>
              <td className={`${cell} text-right tabular-nums`}>{person.availablePct}%</td>
              <td className={`${cell} text-right tabular-nums`}>{formatFte(Math.max(0, 1 - person.fte))}</td>
            </tr>
          ))}
        </SummaryTable>
      </div>

      {drill && (
        <SlideOverListPanel
          title={drill.title}
          subtitle={drill.subtitle}
          items={drill.items}
          groups={drill.groups}
          defaultExpanded={drill.defaultExpanded}
          onClose={() => setDrill(null)}
        />
      )}
    </div>
  );
}
