import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Capacity } from '@/types';
import { fetchProjects } from '@/api/projects.api';
import { availabilityLabel, capacityPeriodView } from '@/utils/allocationUi';
import {
  functionalUnitProjects,
  groupCapacityByFuManagerProject,
  splitPersonName,
  type CapacityProjectHint,
  type FunctionalUnitAssignment,
} from '@/utils/capacityGroups';

interface ResourceAllocationGridProps {
  rows: Capacity[];
  rangeFrom: string;
  rangeTo: string;
  workCategoryId?: string;
  functionalUnits?: FunctionalUnitAssignment[];
  onSelect?: (row: Capacity) => void;
}

export function ResourceAllocationGrid({
  rows,
  rangeFrom,
  rangeTo,
  workCategoryId,
  functionalUnits = [],
  onSelect,
}: ResourceAllocationGridProps) {
  const cellClass = 'whitespace-nowrap px-4 py-2';
  const [showDetails, setShowDetails] = useState(true);
  const { data: projectsPage } = useQuery({
    queryKey: ['projects', 'utilization-hints', workCategoryId ?? 'all'],
    queryFn: () =>
      fetchProjects({
        size: 500,
        workCategoryId: workCategoryId || undefined,
      }),
  });
  const projectHints = useMemo<CapacityProjectHint[]>(
    () =>
      (projectsPage?.content ?? [])
        .filter((project) => project.workCategoryName?.trim())
        .map((project) => ({
          projectId: project.id,
          projectName: project.name,
          manager: project.engineeringManagerName?.trim() || 'Unassigned',
          functionalUnit: project.workCategoryName!.trim(),
        })),
    [projectsPage],
  );
  const groups = groupCapacityByFuManagerProject(rows, projectHints, functionalUnits);

  let index = 0;

  return (
    <div className="rounded-xl border border-border">
      <div className="flex items-center justify-end border-b border-border px-3 py-1.5">
        <button
          type="button"
          onClick={() => setShowDetails((current) => !current)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text2 hover:bg-bg3 hover:text-accent"
        >
          {showDetails ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          {showDetails ? 'Collapse designation' : 'Show designation'}
        </button>
      </div>
      <div className="max-h-[min(70vh,720px)] overflow-auto">
        <table className="w-max min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
            <tr className="whitespace-nowrap">
              <th className="sticky left-0 z-20 min-w-[16rem] border-b border-r border-border bg-bg2 px-4 py-2">
                Functional unit
              </th>
              <th className="min-w-[10rem] border-b border-r border-border px-4 py-2">Manager</th>
              <th className="w-12 border-b border-border px-3 py-2 text-center">#</th>
              <th className="border-b border-border px-4 py-2">Engineer</th>
              {showDetails && (
                <th className="min-w-[14rem] border-b border-border px-4 py-2">Designation</th>
              )}
              <th className="border-b border-border px-4 py-2">VP</th>
              <th className="border-b border-border px-4 py-2 text-right">Allocated</th>
              <th className="border-b border-border px-4 py-2 text-right">Available</th>
              <th className="border-b border-border px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((fu) => {
              const fuProjects = functionalUnitProjects(fu.functionalUnit, projectHints);
              const managers = fu.managers
                .map((manager) => {
                  const byId = new Map<string, (typeof manager.projects)[0]['leaves'][0]>();
                  for (const project of manager.projects) {
                    for (const leaf of project.leaves) {
                      const existing = byId.get(leaf.employeeId);
                      if (existing) {
                        existing.items.push(...leaf.items);
                      } else {
                        byId.set(leaf.employeeId, { ...leaf, items: [...leaf.items] });
                      }
                    }
                  }
                  return {
                    manager: manager.manager,
                    leaves: [...byId.values()].sort((a, b) =>
                      a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }),
                    ),
                  };
                })
                .filter((manager) => manager.leaves.length > 0);
              const fuRowSpan = managers.reduce((sum, manager) => sum + manager.leaves.length, 0);
              if (fuRowSpan === 0) return [];
              let fuStarted = false;
              return managers.flatMap((manager) => {
                let managerStarted = false;
                const { firstName, lastName } = splitPersonName(manager.manager);
                return manager.leaves.map((leaf) => {
                  const row = leaf.row;
                  const scoped = {
                    ...row,
                    allocations: leaf.items,
                    periodAllocations: leaf.items,
                  };
                  const { totalPercentage, availablePercentage, overAllocated } = capacityPeriodView(
                    scoped,
                    rangeFrom,
                    rangeTo,
                  );
                  const inactive = (row.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE';
                  index += 1;
                  const n = index;
                  const showFu = !fuStarted;
                  const showManager = !managerStarted;
                  fuStarted = true;
                  managerStarted = true;
                  return (
                    <tr
                      key={`${fu.functionalUnit}:${manager.manager}:${row.employeeId}`}
                      className={`border-t border-border hover:bg-bg2/50 ${
                        inactive ? 'bg-bg2/40 text-text3' : 'bg-bg'
                      }`}
                    >
                      {showFu && (
                        <td
                          rowSpan={fuRowSpan}
                          className="sticky left-0 z-[1] min-w-[16rem] max-w-[22rem] border-r border-border bg-bg px-4 py-2 align-top font-semibold"
                        >
                          <div>
                            <p>{fu.functionalUnit}</p>
                            {fuProjects.length > 0 && (
                              <p className="mt-0.5 text-xs font-medium text-text2">({fuProjects.join(', ')})</p>
                            )}
                          </div>
                        </td>
                      )}
                      {showManager && (
                        <td
                          rowSpan={manager.leaves.length}
                          className="min-w-[10rem] border-r border-border px-4 py-2 align-top font-semibold"
                        >
                          <div>
                            <p>{firstName}</p>
                            {lastName ? <p>{lastName}</p> : null}
                            <p className="mt-0.5 text-xs font-medium text-text2">({manager.leaves.length})</p>
                          </div>
                        </td>
                      )}
                      <td className={`${cellClass} text-center text-xs tabular-nums text-text2`}>{n}</td>
                      <td className={cellClass}>
                        <button
                          type="button"
                          onClick={() => onSelect?.(row)}
                          className={`max-w-[220px] truncate font-medium hover:underline ${
                            inactive ? 'text-text3' : 'text-accent'
                          }`}
                          title={row.employeeName}
                        >
                          {row.employeeName}
                          {inactive ? ' (Inactive)' : ''}
                        </button>
                      </td>
                      {showDetails && (
                        <td className={`${cellClass} text-text2`}>{row.designationName ?? '—'}</td>
                      )}
                      <td className={`${cellClass} text-text2`}>{row.vpName ?? '—'}</td>
                      <td
                        className={`${cellClass} text-right font-semibold tabular-nums ${
                          inactive
                            ? 'text-text3'
                            : overAllocated
                              ? 'text-danger'
                              : totalPercentage >= 90
                                ? 'text-warning'
                                : 'text-text'
                        }`}
                      >
                        {totalPercentage}%
                      </td>
                      <td
                        className={`${cellClass} text-right font-semibold tabular-nums ${
                          inactive ? 'text-text3' : 'text-accent'
                        }`}
                      >
                        {availablePercentage}%
                      </td>
                      <td className={`${cellClass} text-text2`}>
                        {inactive
                          ? 'Inactive'
                          : row.benchStatus === 'BENCH' && totalPercentage === 0
                            ? 'On bench'
                            : availabilityLabel(totalPercentage)}
                      </td>
                    </tr>
                  );
                });
              });
            })}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-4 py-2 text-xs text-text2">
        {rows.length} team member{rows.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}
