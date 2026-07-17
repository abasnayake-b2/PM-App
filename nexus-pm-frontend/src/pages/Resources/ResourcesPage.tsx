import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { Download, GanttChart, LayoutGrid, Table, Users } from 'lucide-react';
import { AllocationTimeline } from '@/components/AllocationTimeline';
import { ResourceAllocationCard } from '@/components/ResourceAllocationCard';
import { ResourceAllocationGrid } from '@/components/ResourceAllocationGrid';
import { TeamMemberPanel } from '@/components/TeamMemberPanel';
import { useCapacity, useAllocations, useUpdateAllocation } from '@/hooks/useResources';
import { exportCapacityTimeline } from '@/api/resources.api';
import { fetchRosterDesignations, fetchRosterStreams } from '@/api/rosterLookups.api';
import { fetchEngineeringManagers } from '@/api/teamRoster.api';
import { useIssues } from '@/hooks/useIssues';
import { useAuthStore } from '@/store/useAuthStore';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { isManagerOrAboveRole, hasOrgWideVisibility } from '@/utils/orgRoles';
import { defaultDateRange, todayLocalIso } from '@/utils/allocationUi';
import type { Capacity } from '@/types';

type ViewMode = 'cards' | 'grid' | 'timeline';

export function ResourcesPage() {
  const role = useAuthStore((s) => s.user?.role);
  const orgWideVisibility = useAuthStore((s) => s.user?.orgWideVisibility);
  const { can } = usePermissions();
  // VP / CXO / Manager get VIEW-only allocation perms but still need the team capacity board
  const showTeamCapacity = can(P.ALLOCATIONS_VIEW) && isManagerOrAboveRole(role);
  const canEditAllocations = can(P.ALLOCATIONS_CREATE) || can(P.ALLOCATIONS_UPDATE);
  const isScopedManager = showTeamCapacity && !hasOrgWideVisibility(role, orgWideVisibility);
  const userName = useAuthStore((s) => s.user?.name);

  const defaults = defaultDateRange();
  const [view, setView] = useState<ViewMode>('cards');
  const [teamFilter, setTeamFilter] = useState('');
  const [designationFilter, setDesignationFilter] = useState('');
  const [engineeringManagerFilter, setEngineeringManagerFilter] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const deferredNameSearch = useDeferredValue(nameSearch);
  const userId = useAuthStore((s) => s.user?.userId);

  useEffect(() => {
    if (isScopedManager && userName) {
      setEngineeringManagerFilter(userName);
    }
  }, [isScopedManager, userName]);
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);
  const [selectedRow, setSelectedRow] = useState<Capacity | null>(null);
  const [panelEditAllocationId, setPanelEditAllocationId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [dragSaveError, setDragSaveError] = useState<string | null>(null);
  const updateAllocation = useUpdateAllocation();

  const capacityParams = {
    from: fromDate,
    to: toDate,
    asOf: todayLocalIso(),
    team: teamFilter || undefined,
    designationCode: designationFilter || undefined,
    engineeringManager: engineeringManagerFilter || undefined,
    name: deferredNameSearch.trim() || undefined,
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
  const linkedEmployeeId = selectedRow?.employeeId;
  const { data: assignedIssues, isLoading: assignedIssuesLoading } = useIssues(
    { assignedToId: linkedEmployeeId },
    { enabled: !!linkedEmployeeId },
  );
  const { data: myAllocations, isLoading: myLoading } = useAllocations(
    { employeeId: userId },
    { enabled: !!userId },
  );

  const filteredCapacity = useMemo(() => {
    if (!capacity) return [];
    const sortKey = (value?: string) => (value?.trim() ? value.trim().toLowerCase() : '\uffff');
    return [...capacity].sort(
      (a, b) =>
        sortKey(a.vpName).localeCompare(sortKey(b.vpName)) ||
        sortKey(a.engineeringManagerName).localeCompare(sortKey(b.engineeringManagerName)) ||
        a.employeeName.localeCompare(b.employeeName),
    );
  }, [capacity]);

  const selectedEmployeeCapacity = useMemo(() => {
    if (!selectedRow) return null;
    return capacity?.find((row) => row.employeeId === selectedRow.employeeId) ?? selectedRow;
  }, [capacity, selectedRow]);

  async function handleExportTimeline() {
    setExportError(null);
    setExporting(true);
    try {
      await exportCapacityTimeline(capacityParams);
    } catch {
      setExportError('Failed to export timeline Excel.');
    } finally {
      setExporting(false);
    }
  }

  if (!showTeamCapacity) {
    return (
      <div>
        <div className="flex items-center gap-3">
          <Users className="text-accent" size={28} />
          <div>
            <h1 className="text-2xl font-bold">Your allocations</h1>
            <p className="text-text2">Projects you are currently assigned to</p>
          </div>
        </div>
        {myLoading && <p className="mt-6 text-text2">Loading…</p>}
        {!myLoading && (!myAllocations || myAllocations.length === 0) && (
          <p className="mt-6 text-text2">No active allocations.</p>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {myAllocations?.map((a) => (
            <div key={a.id} className="card p-4">
              <h3 className="font-medium">{a.issueTitle}</h3>
              <p className="text-sm text-text2">{a.projectName}</p>
              <p className="text-xs text-text2">{a.roleOnProject ?? 'Team member'}</p>
              <p className="mt-2 text-xs text-text2">
                {a.percentage}% · {a.fromDate}
                {a.toDate ? ` → ${a.toDate}` : ' → ongoing'}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resource Utilization</h1>
          <p className="mt-1 text-text2">
            {isScopedManager
              ? 'Your team and allocations on your projects'
              : 'Team capacity from the employee roster and issue-level allocations'}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-bg2 p-4">
        <div className="flex rounded-lg border border-border p-0.5">
          <button
            type="button"
            onClick={() => setView('cards')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              view === 'cards' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
            }`}
          >
            <LayoutGrid size={14} />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setView('grid')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              view === 'grid' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
            }`}
          >
            <Table size={14} />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView('timeline')}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              view === 'timeline' ? 'bg-bg3 text-accent' : 'text-text2 hover:text-text'
            }`}
          >
            <GanttChart size={14} />
            Timeline
          </button>
        </div>

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
          <span className="text-text2">Name</span>
          <input
            type="search"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Type a name…"
            className="mt-1 block min-w-[10rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          />
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
          <span className="text-text2">Engineering manager</span>
          <select
            value={engineeringManagerFilter}
            onChange={(e) => setEngineeringManagerFilter(e.target.value)}
            className="mt-1 block min-w-[10rem] max-w-[14rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All managers</option>
            {engineeringManagers.map((name) => (
              <option key={name} value={name}>
                {name}
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

        <span className="ml-auto text-sm text-text2">
          {filteredCapacity.length} team member{filteredCapacity.length !== 1 ? 's' : ''}
        </span>

        {view === 'timeline' && (
          <button
            type="button"
            onClick={handleExportTimeline}
            disabled={exporting || isLoading || filteredCapacity.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg3 px-3 py-2 text-sm font-medium text-text hover:bg-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export Excel'}
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-text3">
        Allocated % is the average daily load over the selected From–To dates. Available % = max(0, 100 −
        allocated).
      </p>

      {exportError && <p className="mt-3 text-sm text-danger">{exportError}</p>}

      {isLoading && <p className="mt-6 text-text2">Loading allocation data…</p>}
      {error && <p className="mt-6 text-danger">Failed to load capacity data.</p>}

      {!isLoading && !error && filteredCapacity.length === 0 && (
        <p className="mt-6 text-text2">
          No employees in the roster. Upload a Team Excel file under Team → Employees first.
        </p>
      )}

      {!isLoading && !error && view === 'cards' && filteredCapacity.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCapacity.map((row) => (
            <ResourceAllocationCard
              key={row.employeeId}
              row={row}
              rangeFrom={fromDate}
              rangeTo={toDate}
              onSelect={(row) => {
                setPanelEditAllocationId(null);
                setSelectedRow(row);
              }}
            />
          ))}
        </div>
      )}

      {!isLoading && !error && view === 'grid' && filteredCapacity.length > 0 && (
        <div className="mt-6">
          <ResourceAllocationGrid
            rows={filteredCapacity}
            rangeFrom={fromDate}
            rangeTo={toDate}
            onSelect={(row) => {
              setPanelEditAllocationId(null);
              setSelectedRow(row);
            }}
          />
        </div>
      )}

      {selectedEmployeeCapacity && (
        <TeamMemberPanel
          row={selectedEmployeeCapacity}
          rangeFrom={fromDate}
          rangeTo={toDate}
          issues={assignedIssues?.content ?? []}
          issuesLoading={assignedIssuesLoading}
          canEdit={canEditAllocations}
          initialEditingAllocationId={panelEditAllocationId}
          onClose={() => {
            setSelectedRow(null);
            setPanelEditAllocationId(null);
          }}
          onEditAllocationClosed={() => setPanelEditAllocationId(null)}
        />
      )}

      {!isLoading && !error && view === 'timeline' && filteredCapacity.length > 0 && (
        <div className="mt-6 min-w-0 max-w-full">
          {dragSaveError && (
            <p className="mb-3 text-sm text-danger">{dragSaveError}</p>
          )}
          <AllocationTimeline
            rows={filteredCapacity}
            from={fromDate}
            to={toDate}
            canEdit={canEditAllocations}
            datesSaving={updateAllocation.isPending}
            onRowSelect={(row) => {
              setPanelEditAllocationId(null);
              setSelectedRow(row);
            }}
            onAllocationEdit={(row, allocation) => {
              setSelectedRow(row);
              setPanelEditAllocationId(allocation.id);
            }}
            onAllocationDatesChange={(_row, allocation, next) => {
              setDragSaveError(null);
              updateAllocation.mutate(
                {
                  id: allocation.id,
                  payload: {
                    roleOnProject: allocation.roleOnProject,
                    percentage: allocation.percentage,
                    fromDate: next.fromDate,
                    toDate: next.toDate,
                    billable: allocation.billable,
                  },
                },
                {
                  onError: (err) => {
                    const message = isAxiosError(err)
                      ? (err.response?.data as { message?: string } | undefined)?.message ??
                        err.message
                      : err instanceof Error
                        ? err.message
                        : 'Failed to update allocation dates';
                    setDragSaveError(message);
                  },
                },
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
