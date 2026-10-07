import { useMemo, useState, type ReactNode } from 'react';
import { SlideOverListPanel } from '@/components/SlideOverListPanel';
import type { Capacity, Allocation } from '@/types';
import type { SlideOverEntry, SlideOverGroup } from '@/utils/breakdownProjects';
import {
  allocationTargetLabel,
  formatAllocationDateRange,
} from '@/utils/allocationUi';
import {
  buildAllocationSummary,
  formatFte,
  formatPersonDays,
  type AllocationSummaryFilters,
  type ManagerAllocationSummary,
  type ProjectAllocationSummary,
  type SummaryPerson,
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
    formatAllocationDateRange(allocation),
    allocation.taskTypeName,
    allocation.taskCategoryName,
  ].filter(Boolean);
  return {
    label: `${allocation.percentage}% · ${allocationTargetLabel(allocation)}`,
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

function peopleGroups(people: SummaryPerson[]): SlideOverGroup[] {
  const allocated = people.filter((person) => person.fte > 0);
  const unallocated = people.filter((person) => person.fte <= 0);
  return [
    {
      title: `Allocated (${allocated.length})`,
      items: allocated.map(personEntry),
    },
    {
      title: `Not allocated (${unallocated.length})`,
      items: unallocated.map(personEntry),
    },
  ];
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

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text2">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-text2">{hint}</p>}
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

export function ResourceAllocationSummary({
  rows,
  rangeFrom,
  rangeTo,
  filters,
}: {
  rows: Capacity[];
  rangeFrom: string;
  rangeTo: string;
  filters?: AllocationSummaryFilters;
}) {
  const [drill, setDrill] = useState<DrillPanel | null>(null);
  const summary = useMemo(
    () => buildAllocationSummary(rows, rangeFrom, rangeTo, filters),
    [rows, rangeFrom, rangeTo, filters],
  );

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
      groups: peopleGroups(manager.people),
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

  const cell = 'whitespace-nowrap px-3 py-2';

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Team members" value={String(summary.totals.teamSize)} />
        <Kpi
          label="People allocated"
          value={String(summary.totals.allocatedCount)}
          hint={`${summary.totals.unallocatedCount} not allocated`}
        />
        <Kpi label="Projects" value={String(summary.totals.projectCount)} />
        <Kpi
          label="Allocated FTE"
          value={formatFte(summary.totals.allocatedFte)}
          hint={`${summary.totals.rangeDays} calendar days`}
        />
        <Kpi label="Available FTE" value={formatFte(summary.totals.availableFte)} />
      </div>

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
