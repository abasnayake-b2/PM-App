import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResourceAllocationSummary } from '@/components/ResourceAllocationSummary';
import { ManagerNameOptGroups } from '@/components/ManagerNameOptGroups';
import { MultiStatusFilter } from '@/components/MultiStatusFilter';
import { useCapacity } from '@/hooks/useResources';
import { useDepartments } from '@/hooks/useEmployees';
import { fetchRosterDesignations, fetchRosterStreams } from '@/api/rosterLookups.api';
import { fetchEngineeringManagers, fetchTeamManagement } from '@/api/teamRoster.api';
import { fetchTaskCategories, fetchTaskTypes, fetchProjectTypes, fetchWorkCategories } from '@/api/lookup.api';
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
  directorsFromManagerReportingLine,
  groupedManagerNames,
  isDirectorOrVpTitle,
} from '@/utils/managementRoles';
import { isActiveRosterStatus } from '@/utils/rosterStatus';
import { compareByPriority } from '@/utils/allocationSummary';

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
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [engineeringManagerFilter, setEngineeringManagerFilter] = useState('');
  const [taskCategoryId, setTaskCategoryId] = useState('');
  const [taskTypeId, setTaskTypeId] = useState('');
  const [projectTypeId, setProjectTypeId] = useState('');
  const [functionalUnitCategoryId, setFunctionalUnitCategoryId] = useState('');
  const [directorIds, setDirectorIds] = useState<string[]>([]);
  const [workCategoryId, setWorkCategoryId] = useState('');
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
    department: departmentFilter || undefined,
    designationCode: designationFilter || undefined,
    engineeringManager: engineeringManagerFilter || undefined,
    workCategoryId: workCategoryId || undefined,
  };

  const { data: capacity, isLoading, error } = useCapacity(capacityParams, {
    enabled: showTeamCapacity,
  });
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
  const { data: projectTypes = [] } = useQuery({
    queryKey: ['project-types'],
    queryFn: fetchProjectTypes,
    enabled: showTeamCapacity,
  });
  const { data: workCategories = [] } = useQuery({
    queryKey: ['work-categories'],
    queryFn: fetchWorkCategories,
    enabled: showTeamCapacity,
    refetchOnMount: 'always',
  });
  const managerGroups = useMemo(
    () => groupedManagerNames(management, engineeringManagers),
    [management, engineeringManagers],
  );
  const sortedWorkCategories = useMemo(
    () => [...workCategories].sort(compareByPriority),
    [workCategories],
  );
  const unitsWithDirectors = useMemo(
    () =>
      sortedWorkCategories.map((category) => {
        if (category.directors && category.directors.length > 0) return category;
        const inferred = directorsFromManagerReportingLine(
          category.engineeringManagers ?? [],
          management,
        );
        if (inferred.length === 0) return category;
        return { ...category, directors: inferred };
      }),
    [sortedWorkCategories, management],
  );
  const directorOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    const add = (id: string, name: string, roleTitle?: string) => {
      const role = roleTitle?.trim();
      byId.set(id, { id, name: role ? `${name} · ${role}` : name });
    };
    for (const person of management) {
      if ((person.status ?? 'ACTIVE').toUpperCase() === 'INACTIVE') continue;
      if (isDirectorOrVpTitle(person.roleTitle)) {
        add(person.id, person.fullName, person.roleTitle);
      }
    }
    for (const category of unitsWithDirectors) {
      for (const director of category.directors ?? []) {
        if (!byId.has(director.id)) add(director.id, director.name, director.roleTitle);
      }
    }
    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [management, unitsWithDirectors]);
  const directorScopedUnits = useMemo(() => {
    if (directorIds.length === 0) return unitsWithDirectors;
    const selected = new Set(directorIds);
    return unitsWithDirectors.filter((category) =>
      (category.directors ?? []).some((director) => selected.has(director.id)),
    );
  }, [unitsWithDirectors, directorIds]);
  const functionalUnitCategories = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; sortOrder: number }>();
    for (const category of directorScopedUnits) {
      const id = category.functionalUnitCategoryId;
      const name = category.functionalUnitCategoryName?.trim();
      if (!id || !name) continue;
      const sortOrder = category.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const existing = byId.get(id);
      if (!existing || sortOrder < existing.sortOrder) {
        byId.set(id, { id, name, sortOrder });
      }
    }
    return [...byId.values()].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [directorScopedUnits]);
  const categoryUnits = useMemo(
    () =>
      functionalUnitCategoryId
        ? directorScopedUnits.filter(
            (category) => category.functionalUnitCategoryId === functionalUnitCategoryId,
          )
        : directorScopedUnits,
    [directorScopedUnits, functionalUnitCategoryId],
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
      projectTypeId: projectTypeId || undefined,
      workCategoryIds:
        (functionalUnitCategoryId || directorIds.length > 0) && !workCategoryId
          ? categoryUnits.map((category) => category.id)
          : undefined,
    }),
    [
      taskCategoryId,
      taskTypeId,
      projectTypeId,
      functionalUnitCategoryId,
      directorIds,
      workCategoryId,
      categoryUnits,
    ],
  );

  useEffect(() => {
    if (
      functionalUnitCategoryId &&
      !directorScopedUnits.some((category) => category.functionalUnitCategoryId === functionalUnitCategoryId)
    ) {
      setFunctionalUnitCategoryId('');
    }
    if (workCategoryId && !categoryUnits.some((category) => category.id === workCategoryId)) {
      setWorkCategoryId('');
    }
  }, [directorScopedUnits, categoryUnits, functionalUnitCategoryId, workCategoryId]);

  if (!showTeamCapacity) {
    return <Navigate to="/resources" replace />;
  }

  return (
    <div className="min-w-0 max-w-full">
      <p className="text-text2">
        Project-wise and manager-team allocation for the selected date range.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-bg2 p-4">
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
          <span className="text-text2">Department</span>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
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

        <MultiStatusFilter
          fieldLabel="Directors / VP"
          allLabel="All directors / VPs"
          menuLabel="Directors / VP"
          noun="director"
          plural="directors / VPs"
          className="z-30"
          statuses={directorOptions}
          selectedIds={directorIds}
          onChange={setDirectorIds}
        />

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
          <span className="text-text2">Project type</span>
          <select
            value={projectTypeId}
            onChange={(e) => setProjectTypeId(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All project types</option>
            {projectTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">Functional unit category</span>
          <select
            value={functionalUnitCategoryId}
            onChange={(e) => setFunctionalUnitCategoryId(e.target.value)}
            className="mt-1 block min-w-[14rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All categories</option>
            {functionalUnitCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">Functional unit</span>
          <select
            value={workCategoryId}
            onChange={(e) => setWorkCategoryId(e.target.value)}
            className="mt-1 block min-w-[14rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All functional units</option>
            {categoryUnits.map((category) => (
              <option key={category.id} value={category.id}>
                {category.sortOrder != null ? `${category.sortOrder}. ${category.name}` : category.name}
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
            workCategories={categoryUnits}
            workCategoryId={workCategoryId || undefined}
            includeUnassigned={!functionalUnitCategoryId && !workCategoryId && directorIds.length === 0}
          />
        </div>
      )}
    </div>
  );
}
