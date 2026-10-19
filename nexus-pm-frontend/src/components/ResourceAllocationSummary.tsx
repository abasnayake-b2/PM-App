import { useEffect, useMemo, useState, type ReactNode } from 'react';
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

function personEntry(person: SummaryPerson): SlideOverEntry {
  const status = person.fte > 0 ? `${person.allocatedPct}% allocated` : 'Not allocated';
  return {
    label: person.employeeName,
    meta: `${status} · ${formatFte(person.fte)} FTE${
      person.designationName ? ` · ${person.designationName}` : ''
    }`,
  };
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
}: {
  value: number;
  onClick?: () => void;
}) {
  if (!onClick || value === 0) {
    return <span className="font-semibold tabular-nums">{value}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-semibold tabular-nums text-accent hover:underline"
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
}: {
  title: string;
  description: string;
  headers: { label: string; align?: 'left' | 'right' }[];
  children: ReactNode;
  empty: boolean;
  emptyMessage?: string;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="rounded-xl border border-border">
        <div className="max-h-[min(60vh,640px)] overflow-auto">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
              <tr className="whitespace-nowrap">
                {headers.map((header) => (
                  <th
                    key={header.label}
                    className={
                      header.align === 'right' ? 'px-3 py-2 text-right' : 'px-3 py-2'
                    }
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
}: {
  rows: Capacity[];
  rangeFrom: string;
  rangeTo: string;
  filters?: AllocationSummaryFilters;
  workCategories?: WorkCategory[];
  workCategoryId?: string;
}) {
  const [drill, setDrill] = useState<DrillPanel | null>(null);
  const [openManagers, setOpenManagers] = useState<Set<string>>(() => new Set());
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
        { includeUnassigned: !workCategoryId },
      ),
    [summary.allocatedPeople, summary.managers, scopedWorkCategories, rangeFrom, rangeTo, workCategoryId],
  );
  const categoryIds = categoryTrees.map((tree) => tree.id).join('|');
  useEffect(() => {
    setOpenManagers(new Set());
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

  const openTreeManagerPeople = (node: WorkCategoryManagerNode) => {
    setDrill({
      title: node.managerName,
      subtitle: `${node.allocatedCount} people allocated · ${formatFte(node.allocatedFte)} FTE · ${rangeFrom} → ${rangeTo}`,
      groups: engineerAllocationGroups(node.team),
      defaultExpanded: true,
    });
  };

  const openTreeManagerProjects = (node: WorkCategoryManagerNode) => {
    setDrill({
      title: node.managerName,
      subtitle: `Projects in ${rangeFrom} → ${rangeTo}`,
      items: node.projects.map((project) => ({
        label: project.name,
        meta: `${formatFte(project.fte)} FTE`,
      })),
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
        title="By functional unit → manager → team"
        description="People allocated to each functional unit, grouped under the manager assigned to that functional unit."
        headers={[
          { label: 'Priority', align: 'right' },
          { label: 'Functional unit' },
          { label: 'Manager' },
          { label: 'Team', align: 'right' },
          { label: 'Allocated', align: 'right' },
          { label: 'Projects', align: 'right' },
          { label: 'FTE', align: 'right' },
          { label: 'Available FTE', align: 'right' },
        ]}
        empty={categoryTrees.length === 0}
        emptyMessage="No functional units."
      >
        {categoryTrees.flatMap((tree) => {
          const managers = managersForFunctionalUnit(
            tree,
            scopedWorkCategories.find((category) => category.id === tree.id),
          );
          if (managers.length === 0) {
            return [
              <tr key={tree.id} className="border-t border-border hover:bg-bg2/50">
                <td className={`${cell} text-right tabular-nums text-text2`}>
                  {tree.sortOrder != null ? tree.sortOrder : '—'}
                </td>
                <td className={`${treeCell} font-semibold`}>{tree.name}</td>
                <td className={`${treeCell} text-text2`}>No engineering managers assigned.</td>
                <td className={`${cell} text-right tabular-nums`}>0</td>
                <td className={`${cell} text-right tabular-nums`}>0</td>
                <td className={`${cell} text-right tabular-nums`}>0</td>
                <td className={`${cell} text-right tabular-nums`}>{formatFte(0)}</td>
                <td className={`${cell} text-right tabular-nums`}>{formatFte(0)}</td>
              </tr>,
            ];
          }
          return managers.flatMap((node, managerIndex) => {
            const managerOpen = openManagers.has(node.key);
            const rows = [
              <tr key={node.key} className="border-t border-border hover:bg-bg2/50">
                <td className={`${cell} text-right tabular-nums text-text2`}>
                  {managerIndex === 0 ? (tree.sortOrder != null ? tree.sortOrder : '—') : ''}
                </td>
                <td className={`${treeCell} font-semibold`}>
                  {managerIndex === 0 ? tree.name : ''}
                </td>
                <td className={`${treeCell} font-medium`}>
                  <ExpandLabel
                    open={managerOpen}
                    label={node.managerName}
                    onClick={() => toggleManager(node.key)}
                  />
                </td>
                <td className={`${cell} text-right`}>
                  <CountButton value={node.teamSize} onClick={() => openTreeManagerPeople(node)} />
                </td>
                <td className={`${cell} text-right`}>
                  <CountButton value={node.allocatedCount} onClick={() => openTreeManagerPeople(node)} />
                </td>
                <td className={`${cell} text-right`}>
                  <CountButton value={node.projectCount} onClick={() => openTreeManagerProjects(node)} />
                </td>
                <td className={`${cell} text-right tabular-nums`}>{formatFte(node.allocatedFte)}</td>
                <td className={`${cell} text-right tabular-nums`}>{formatFte(node.availableFte)}</td>
              </tr>,
            ];
            if (!managerOpen) return rows;
            if (node.team.length === 0) {
              rows.push(
                <tr key={`${node.key}:empty`} className="border-t border-border">
                  <td className={cell} />
                  <td className={treeCell} />
                  <td className={`${treeCell} ${indentClass(1)} text-text2`}>
                    No people allocated to this functional unit.
                  </td>
                  <td className={cell} />
                  <td className={cell} />
                  <td className={cell} />
                  <td className={cell} />
                  <td className={cell} />
                </tr>,
              );
              return rows;
            }
            for (const person of node.team) {
              rows.push(
                <tr key={`${node.key}:${person.employeeId}`} className="border-t border-border hover:bg-bg2/30">
                  <td className={cell} />
                  <td className={treeCell} />
                  <td className={`${treeCell} ${indentClass(1)}`}>
                    {person.fte > 0 ? (
                      <button
                        type="button"
                        onClick={() => openPersonAllocations(person)}
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
                  <td className={`${cell} text-right tabular-nums`}>{person.fte > 0 ? 1 : 0}</td>
                  <td className={`${cell} text-right`}>
                    <CountButton
                      value={person.allocations.length}
                      onClick={
                        person.allocations.length > 0
                          ? () => openPersonAllocations(person)
                          : undefined
                      }
                    />
                  </td>
                  <td className={`${cell} text-right tabular-nums`}>{formatFte(person.fte)}</td>
                  <td className={`${cell} text-right tabular-nums`}>
                    {formatFte(Math.max(0, 1 - person.fte))}
                  </td>
                </tr>,
              );
            }
            return rows;
          });
        })}
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
