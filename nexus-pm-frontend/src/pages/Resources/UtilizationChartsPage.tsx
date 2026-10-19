import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ManagerNameOptGroups } from '@/components/ManagerNameOptGroups';
import {
  MonthlyAllocationChart,
  MonthlyAllocationLineChart,
} from '@/components/MonthlyAllocationChart';
import { SlideOverListPanel } from '@/components/SlideOverListPanel';
import { useCapacity } from '@/hooks/useResources';
import { useDepartments } from '@/hooks/useEmployees';
import { fetchRosterDesignations, fetchRosterStreams } from '@/api/rosterLookups.api';
import { fetchEngineeringManagers, fetchTeamManagement } from '@/api/teamRoster.api';
import { fetchWorkCategories } from '@/api/lookup.api';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import {
  hasOrgWideVisibility,
  isDeliveryManagerRole,
  isManagerOrAboveRole,
  isScopedEngineeringManagerRole,
} from '@/utils/orgRoles';
import { defaultDateRange, todayLocalIso } from '@/utils/allocationUi';
import {
  monthlyAllocationSeries,
  type MonthlyAllocationPerson,
  type MonthlyAllocationPoint,
} from '@/utils/allocationCharts';
import type { SlideOverEntry, SlideOverGroup } from '@/utils/breakdownProjects';
import { groupedManagerNames } from '@/utils/managementRoles';
import { isActiveRosterStatus } from '@/utils/rosterStatus';
import {
  buildAllocationSummary,
  compareByPriority,
  type SummaryPerson,
} from '@/utils/allocationSummary';

const fieldClass = 'mt-1 block rounded-lg border border-border bg-bg3 px-3 py-2 text-sm';

type DrillPanel = {
  title: string;
  subtitle: string;
  items?: SlideOverEntry[];
  groups?: SlideOverGroup[];
  defaultExpanded?: boolean;
};

function personEntry(person: MonthlyAllocationPerson): SlideOverEntry {
  const meta = [person.designation, person.manager].filter(Boolean).join(' · ');
  return meta ? { label: person.name, meta } : person.name;
}

function peopleGroup(title: string, people: MonthlyAllocationPerson[]): SlideOverGroup {
  return {
    title: `${title} (${people.length})`,
    items: people.map(personEntry),
  };
}

function summaryPersonEntry(person: SummaryPerson): SlideOverEntry {
  const meta = [person.designationName, person.engineeringManagerName].filter(Boolean).join(' · ');
  return meta ? { label: person.employeeName, meta } : person.employeeName;
}

function Kpi({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick?: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-text2">{label}</p>
      {onClick && value > 0 ? (
        <button
          type="button"
          onClick={onClick}
          className="mt-1 text-2xl font-semibold tabular-nums text-accent hover:underline"
          title="View names"
        >
          {value}
        </button>
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      )}
    </div>
  );
}

function CountButton({ value, onClick }: { value: number; onClick?: () => void }) {
  if (!onClick || value === 0) {
    return <span className="tabular-nums">{value}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="tabular-nums font-semibold text-accent hover:underline"
      title="View people"
    >
      {value}
    </button>
  );
}

export function UtilizationChartsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const orgWideVisibility = useAuthStore((s) => s.user?.orgWideVisibility);
  const userName = useAuthStore((s) => s.user?.name);
  const { can } = usePermissions();
  const showTeamCapacity = can(P.ALLOCATIONS_VIEW);
  const locksEmFilter =
    showTeamCapacity &&
    !hasOrgWideVisibility(role, orgWideVisibility) &&
    (isScopedEngineeringManagerRole(role) ||
      isDeliveryManagerRole(role) ||
      isManagerOrAboveRole(role));
  const isScopedManager = showTeamCapacity && !hasOrgWideVisibility(role, orgWideVisibility);

  const defaults = defaultDateRange();
  const [teamFilter, setTeamFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [engineeringManagerFilter, setEngineeringManagerFilter] = useState('');
  const [workCategoryId, setWorkCategoryId] = useState('');
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [drill, setDrill] = useState<DrillPanel | null>(null);

  const openAllocated = (point: MonthlyAllocationPoint) => {
    setDrill({
      title: point.label,
      subtitle: `${point.allocated} allocated · ${point.from} → ${point.to}`,
      items: point.allocatedPeople.map(personEntry),
    });
  };

  const openNotAllocated = (point: MonthlyAllocationPoint) => {
    setDrill({
      title: point.label,
      subtitle: `${point.notAllocated} not allocated · ${point.from} → ${point.to}`,
      items: point.notAllocatedPeople.map(personEntry),
    });
  };

  const openTeam = (point: MonthlyAllocationPoint) => {
    setDrill({
      title: point.label,
      subtitle: `${point.allocated + point.notAllocated} people · ${point.from} → ${point.to}`,
      groups: [
        peopleGroup('Allocated', point.allocatedPeople),
        peopleGroup('Not allocated', point.notAllocatedPeople),
      ].filter((group) => group.items.length > 0),
      defaultExpanded: true,
    });
  };

  useEffect(() => {
    if (locksEmFilter && userName) {
      setEngineeringManagerFilter(userName);
    }
  }, [locksEmFilter, userName]);

  const rangeReady = Boolean(fromDate && toDate && toDate >= fromDate);
  const { data: capacity, isLoading, error } = useCapacity(
    {
      from: fromDate,
      to: toDate,
      asOf: todayLocalIso(),
      team: teamFilter || undefined,
      department: departmentFilter || undefined,
      designationCode: designationFilter || undefined,
      engineeringManager: engineeringManagerFilter || undefined,
      workCategoryId: workCategoryId || undefined,
    },
    { enabled: showTeamCapacity && rangeReady },
  );
  const { data: departments = [] } = useDepartments(showTeamCapacity);
  const { data: streams = [] } = useQuery({
    queryKey: ['roster-streams'],
    queryFn: fetchRosterStreams,
    enabled: showTeamCapacity,
  });
  const { data: designations = [] } = useQuery({
    queryKey: ['roster-designations'],
    queryFn: fetchRosterDesignations,
    enabled: showTeamCapacity,
  });
  const { data: engineeringManagers = [] } = useQuery({
    queryKey: ['engineering-managers'],
    queryFn: fetchEngineeringManagers,
    enabled: showTeamCapacity,
  });
  const { data: management = [] } = useQuery({
    queryKey: ['team-management'],
    queryFn: () => fetchTeamManagement(),
    enabled: showTeamCapacity,
  });
  const { data: workCategories = [] } = useQuery({
    queryKey: ['work-categories'],
    queryFn: fetchWorkCategories,
    enabled: showTeamCapacity,
  });
  const managerGroups = useMemo(
    () => groupedManagerNames(management, engineeringManagers),
    [management, engineeringManagers],
  );
  const sortedWorkCategories = useMemo(
    () => [...workCategories].sort(compareByPriority),
    [workCategories],
  );
  const rows = useMemo(
    () => (capacity ?? []).filter((row) => isActiveRosterStatus(row.status)),
    [capacity],
  );
  const points = useMemo(
    () => (rangeReady ? monthlyAllocationSeries(rows, fromDate, toDate) : []),
    [rows, fromDate, toDate, rangeReady],
  );
  const summary = useMemo(
    () => (rangeReady ? buildAllocationSummary(rows, fromDate, toDate) : null),
    [rows, fromDate, toDate, rangeReady],
  );

  const openRangeTeam = () => {
    if (!summary) return;
    setDrill({
      title: 'Team members',
      subtitle: `${summary.totals.teamSize} people · ${fromDate} → ${toDate}`,
      groups: [
        {
          title: `Allocated (${summary.allocatedPeople.length})`,
          items: summary.allocatedPeople.map(summaryPersonEntry),
        },
        {
          title: `Not allocated (${summary.unallocatedPeople.length})`,
          items: summary.unallocatedPeople.map(summaryPersonEntry),
        },
      ].filter((group) => group.items.length > 0),
      defaultExpanded: true,
    });
  };

  const openRangeAllocated = () => {
    if (!summary) return;
    setDrill({
      title: 'People allocated',
      subtitle: `${summary.totals.allocatedCount} people · ${fromDate} → ${toDate}`,
      items: summary.allocatedPeople.map(summaryPersonEntry),
    });
  };

  const openRangeNotAllocated = () => {
    if (!summary) return;
    setDrill({
      title: 'Not allocated',
      subtitle: `${summary.totals.unallocatedCount} people · ${fromDate} → ${toDate}`,
      items: summary.unallocatedPeople.map(summaryPersonEntry),
    });
  };

  if (!showTeamCapacity) {
    return <Navigate to="/resources" replace />;
  }

  return (
    <div className="min-w-0 max-w-full">
      <p className="text-text2">
        Monthly headcount of people with an allocation versus people with none, for the selected
        dates.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-bg2 p-4">
        <label className="text-sm">
          <span className="text-text2">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-text2">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          <span className="text-text2">Designation</span>
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className={`${fieldClass} min-w-[8rem]`}
          >
            <option value="">All designations</option>
            {designations
              .filter((item) => item.code)
              .map((item) => (
                <option key={item.id} value={item.code}>
                  {item.code} — {item.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-text2">Department</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className={`${fieldClass} min-w-[10rem]`}
          >
            <option value="">All departments</option>
            {departments.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-text2">Team</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className={fieldClass}
          >
            <option value="">All teams</option>
            {streams.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="text-text2">Manager</span>
          <select
            value={engineeringManagerFilter}
            onChange={(e) => setEngineeringManagerFilter(e.target.value)}
            disabled={locksEmFilter}
            className={`${fieldClass} min-w-[12rem] max-w-[18rem] disabled:opacity-70`}
          >
            <option value="">
              {isScopedManager && !locksEmFilter ? 'Your EM team' : 'All managers'}
            </option>
            <ManagerNameOptGroups groups={managerGroups} />
          </select>
        </label>
        <label className="text-sm">
          <span className="text-text2">Functional unit</span>
          <select
            value={workCategoryId}
            onChange={(e) => setWorkCategoryId(e.target.value)}
            className={`${fieldClass} min-w-[14rem]`}
          >
            <option value="">All functional units</option>
            {sortedWorkCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.sortOrder != null ? `${category.sortOrder}. ${category.name}` : category.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!rangeReady && (
        <p className="mt-6 text-sm text-text2">Choose a From date that is on or before the To date.</p>
      )}
      {rangeReady && isLoading && <p className="mt-6 text-text2">Loading allocation chart…</p>}
      {rangeReady && error && <p className="mt-6 text-danger">Failed to load allocation chart.</p>}

      {rangeReady && !isLoading && !error && summary && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Kpi
            label="Team members"
            value={summary.totals.teamSize}
            onClick={openRangeTeam}
          />
          <Kpi
            label="People allocated"
            value={summary.totals.allocatedCount}
            onClick={openRangeAllocated}
          />
          <Kpi
            label="Not allocated"
            value={summary.totals.unallocatedCount}
            onClick={openRangeNotAllocated}
          />
        </div>
      )}

      {rangeReady && !isLoading && !error && (
        <section className="mt-6 rounded-xl border border-border bg-bg2 p-4">
          <h2 className="text-lg font-semibold">Allocated vs not allocated</h2>
          <p className="mt-1 text-sm text-text2">
            Each month counts people in the filtered team. Allocated means at least one allocation
            overlaps that month. Not allocated is everyone else.
          </p>
          {points.length === 0 ? (
            <p className="mt-6 text-sm text-text2">No months in the selected dates.</p>
          ) : (
            <>
              <div className="mt-4">
                <MonthlyAllocationChart points={points} />
              </div>
              <div className="mt-8 border-t border-border pt-6">
                <h3 className="text-base font-semibold">Monthly trend</h3>
                <p className="mt-1 text-sm text-text2">
                  The same allocated and not-allocated counts, drawn as lines across the selected
                  months.
                </p>
                <div className="mt-4">
                  <MonthlyAllocationLineChart points={points} />
                </div>
              </div>
              <div
                className="mt-4 overflow-auto rounded-lg border border-border"
                style={
                  points.length > 12
                    ? { maxHeight: 'calc(2.5rem + 12 * 2.375rem)' }
                    : undefined
                }
              >
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-bg3 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
                    <tr>
                      <th className="px-3 py-2">Month</th>
                      <th className="px-3 py-2 text-right">Allocated</th>
                      <th className="px-3 py-2 text-right">Not allocated</th>
                      <th className="px-3 py-2 text-right">Team</th>
                    </tr>
                  </thead>
                  <tbody>
                    {points.map((point) => (
                      <tr key={point.key} className="border-t border-border">
                        <td className="px-3 py-2 font-medium">{point.label}</td>
                        <td className="px-3 py-2 text-right">
                          <CountButton value={point.allocated} onClick={() => openAllocated(point)} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <CountButton
                            value={point.notAllocated}
                            onClick={() => openNotAllocated(point)}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <CountButton
                            value={point.allocated + point.notAllocated}
                            onClick={() => openTeam(point)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

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
