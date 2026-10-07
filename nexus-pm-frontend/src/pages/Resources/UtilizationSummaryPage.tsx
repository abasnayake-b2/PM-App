import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { ResourceAllocationSummary } from '@/components/ResourceAllocationSummary';
import { ManagerNameOptGroups } from '@/components/ManagerNameOptGroups';
import { useCapacity } from '@/hooks/useResources';
import { fetchRosterDesignations, fetchRosterStreams } from '@/api/rosterLookups.api';
import { fetchEngineeringManagers, fetchTeamManagement } from '@/api/teamRoster.api';
import { fetchTaskCategories, fetchTaskTypes } from '@/api/lookup.api';
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
import { groupedManagerNames } from '@/utils/managementRoles';
import { isActiveRosterStatus } from '@/utils/rosterStatus';

export function UtilizationSummaryPage() {
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
  const [designationFilter, setDesignationFilter] = useState('');
  const [engineeringManagerFilter, setEngineeringManagerFilter] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);

  useEffect(() => {
    if (locksEmFilter && userName) {
      setEngineeringManagerFilter(userName);
    }
  }, [locksEmFilter, userName]);

  const capacityParams = {
    from: fromDate,
    to: toDate,
    asOf: todayLocalIso(),
    team: teamFilter || undefined,
    designationCode: designationFilter || undefined,
    engineeringManager: engineeringManagerFilter || undefined,
  };

  const { data: capacity, isLoading, error } = useCapacity(capacityParams, {
    enabled: showTeamCapacity,
  });
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
  const { data: taskCategories = [] } = useQuery({
    queryKey: ['task-categories'],
    queryFn: fetchTaskCategories,
    enabled: showTeamCapacity,
  });
  const { data: taskTypes = [] } = useQuery({
    queryKey: ['task-types'],
    queryFn: fetchTaskTypes,
    enabled: showTeamCapacity,
  });
  const managerGroups = useMemo(
    () => groupedManagerNames(management, engineeringManagers),
    [management, engineeringManagers],
  );

  const rows = useMemo(() => {
    if (!capacity) return [];
    const sortKey = (value?: string) => (value?.trim() ? value.trim().toLowerCase() : '\uffff');
    return capacity
      .filter((row) => isActiveRosterStatus(row.status))
      .sort(
        (a, b) =>
          sortKey(a.vpName).localeCompare(sortKey(b.vpName)) ||
          sortKey(a.engineeringManagerName).localeCompare(sortKey(b.engineeringManagerName)) ||
          a.employeeName.localeCompare(b.employeeName),
      );
  }, [capacity]);

  const summaryFilters = useMemo(
    () => ({
      taskCategoryId: taskCategoryId || undefined,
      taskTypeId: taskTypeId || undefined,
    }),
    [taskCategoryId, taskTypeId],
  );

  if (!showTeamCapacity) {
    return <Navigate to="/resources" replace />;
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex items-start gap-3">
        <ClipboardList className="mt-1 text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">Utilization summary</h1>
          <p className="mt-1 text-text2">
            Project-wise and manager-team allocation for the selected date range.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-bg2 p-4">
        <label className="text-sm">
          <span className="text-text2">Designation</span>
          <select
            value={designationFilter}
            onChange={(e) => setDesignationFilter(e.target.value)}
            className="mt-1 block min-w-[8rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All designations</option>
            {designations
              .filter((d) => d.code)
              .map((d) => (
                <option key={d.id} value={d.code}>
                  {d.code} — {d.name}
                </option>
              ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">Team</span>
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All teams</option>
            {streams.map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
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
            className="mt-1 block min-w-[12rem] max-w-[18rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm disabled:opacity-70"
          >
            <option value="">
              {isScopedManager && !locksEmFilter ? 'Your EM team' : 'All managers'}
            </option>
            <ManagerNameOptGroups groups={managerGroups} />
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">Task category</span>
          <select
            value={taskCategoryId}
            onChange={(e) => setTaskCategoryId(e.target.value)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {taskCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">Task type</span>
          <select
            value={taskTypeId}
            onChange={(e) => setTaskTypeId(e.target.value)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All types</option>
            {taskTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">From</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="text-text2">To</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <p className="mt-2 text-xs text-text3">
        Duration-weighted allocation over the selected From–To dates (calendar days). FTE is allocated
        load as a fraction of one person for that window.
      </p>

      {isLoading && <p className="mt-6 text-text2">Loading allocation summary…</p>}
      {error && <p className="mt-6 text-danger">Failed to load allocation summary.</p>}

      {!isLoading && !error && (
        <div className="mt-6">
          <ResourceAllocationSummary
            rows={rows}
            rangeFrom={fromDate}
            rangeTo={toDate}
            filters={summaryFilters}
          />
        </div>
      )}
    </div>
  );
}
