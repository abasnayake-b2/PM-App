import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCapacity } from '@/hooks/useResources';
import { useMemberManagerAssignments } from '@/hooks/useTeamRoster';
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
import {
  allocationFunctionalUnitLabel,
  allocationTargetHref,
  allocationTaskLabel,
  averageAllocatedPct,
  capacityAllocations,
  defaultDateRange,
  formatAllocationDateRange,
  todayLocalIso,
} from '@/utils/allocationUi';
import { compareByPriority, formatFte } from '@/utils/allocationSummary';
import { isActiveRosterStatus } from '@/utils/rosterStatus';
import type { ManagerAssignment } from '@/api/teamRoster.api';
import type { Allocation, Capacity } from '@/types';

function uniqueSortedNames(values: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const name = value?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function managerOnDate(
  assignments: ManagerAssignment[] | undefined,
  date: string,
  fallback?: string,
): string {
  const match = assignments?.find(
    (row) => row.fromDate <= date && (!row.toDate || row.toDate >= date),
  );
  return match?.engineeringManagerName?.trim() || fallback?.trim() || 'Unassigned';
}

function engineerMatches(row: Capacity, needle: string): boolean {
  const tokens = needle.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = [
    row.employeeName,
    row.designationName,
    row.engineeringManagerName,
    row.vpName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

function engineerOptionLabel(row: Capacity): string {
  return `${row.employeeName}${row.designationName ? ` · ${row.designationName}` : ''}${
    !isActiveRosterStatus(row.status) ? ' (Inactive)' : ''
  }`;
}

function EngineerSearchSelect({
  rows,
  value,
  onChange,
  isLoading,
}: {
  rows: Capacity[];
  value: string;
  onChange: (employeeId: string) => void;
  isLoading?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = rows.find((row) => row.employeeId === value);
  const [query, setQuery] = useState(selected?.employeeName ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery(selected?.employeeName ?? '');
    }
  }, [selected?.employeeId, selected?.employeeName, open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const matches = useMemo(() => {
    if (selected && query.trim() === selected.employeeName) return rows;
    return rows.filter((row) => engineerMatches(row, query));
  }, [rows, query, selected]);

  const pick = (row: Capacity) => {
    onChange(row.employeeId);
    setQuery(row.employeeName);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative min-w-[16rem] flex-[1.4] text-sm">
      <label className="block">
        <span className="text-text2">Search engineer</span>
        <input
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder={isLoading ? 'Loading engineers…' : 'Type a name…'}
          className="mt-1 block w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setOpen(true);
            if (selected && next.trim() !== selected.employeeName) {
              onChange('');
            }
            if (!next.trim()) onChange('');
          }}
        />
      </label>
      {open && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-bg2 py-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text2">
              {isLoading ? 'Loading engineers…' : 'No matching engineers.'}
            </li>
          ) : (
            matches.map((row) => (
              <li key={row.employeeId}>
                <button
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-bg3 ${
                    row.employeeId === value ? 'bg-bg3 font-medium' : ''
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(row)}
                >
                  <span className="block truncate font-medium">{engineerOptionLabel(row)}</span>
                  {(row.engineeringManagerName || row.vpName) && (
                    <span className="mt-0.5 block truncate text-xs text-text2">
                      {[row.engineeringManagerName, row.vpName].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function HistoryKpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg2 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-text2">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-text2">{hint}</p>}
    </div>
  );
}

export function AllocationHistoryPage() {
  const role = useAuthStore((s) => s.user?.role);
  const orgWideVisibility = useAuthStore((s) => s.user?.orgWideVisibility);
  const userName = useAuthStore((s) => s.user?.name);
  const { can } = usePermissions();
  const showHistory = can(P.ALLOCATIONS_VIEW);
  const canReadManagerHistory = can(P.TEAM_VIEW);
  const locksEmFilter =
    showHistory &&
    !hasOrgWideVisibility(role, orgWideVisibility) &&
    (isScopedEngineeringManagerRole(role) ||
      isDeliveryManagerRole(role) ||
      isManagerOrAboveRole(role));

  const defaults = defaultDateRange();
  const [searchParams, setSearchParams] = useSearchParams();
  const employeeId = searchParams.get('employeeId') ?? '';
  const [vpFilter, setVpFilter] = useState('');
  const [engineeringManagerFilter, setEngineeringManagerFilter] = useState('');
  const [workCategoryId, setWorkCategoryId] = useState('');
  const [fromDate, setFromDate] = useState(defaults.from);
  const [toDate, setToDate] = useState(defaults.to);

  useEffect(() => {
    if (locksEmFilter && userName) {
      setEngineeringManagerFilter(userName);
    }
  }, [locksEmFilter, userName]);

  const { data: workCategories = [] } = useQuery({
    queryKey: ['work-categories'],
    queryFn: fetchWorkCategories,
    enabled: showHistory,
  });
  const sortedWorkCategories = useMemo(
    () => [...workCategories].sort(compareByPriority),
    [workCategories],
  );

  const { data: capacity, isLoading, error } = useCapacity(
    {
      from: fromDate,
      to: toDate,
      asOf: todayLocalIso(),
      engineeringManager: locksEmFilter ? engineeringManagerFilter || undefined : undefined,
    },
    { enabled: showHistory },
  );

  const vpOptions = useMemo(
    () => uniqueSortedNames((capacity ?? []).map((row) => row.vpName)),
    [capacity],
  );
  const emOptions = useMemo(
    () =>
      uniqueSortedNames(
        (capacity ?? [])
          .filter((row) => !vpFilter || (row.vpName ?? '').trim() === vpFilter)
          .map((row) => row.engineeringManagerName),
      ),
    [capacity, vpFilter],
  );

  useEffect(() => {
    if (locksEmFilter || !engineeringManagerFilter) return;
    if (!emOptions.some((name) => name === engineeringManagerFilter)) {
      setEngineeringManagerFilter('');
    }
  }, [emOptions, engineeringManagerFilter, locksEmFilter]);

  const scopedRows = useMemo(() => {
    return [...(capacity ?? [])]
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, undefined, { sensitivity: 'base' }))
      .filter((row) => {
        if (vpFilter && (row.vpName ?? '').trim() !== vpFilter) return false;
        if (
          !locksEmFilter &&
          engineeringManagerFilter &&
          (row.engineeringManagerName ?? '').trim() !== engineeringManagerFilter
        ) {
          return false;
        }
        if (workCategoryId) {
          return capacityAllocations(row).some((allocation) => allocation.workCategoryId === workCategoryId);
        }
        return true;
      });
  }, [capacity, vpFilter, engineeringManagerFilter, locksEmFilter, workCategoryId]);

  const selected: Capacity | undefined = useMemo(
    () =>
      scopedRows.find((row) => row.employeeId === employeeId) ??
      (capacity ?? []).find((row) => row.employeeId === employeeId),
    [scopedRows, capacity, employeeId],
  );

  const { data: managerTimeline = [] } = useMemberManagerAssignments(
    employeeId || null,
    showHistory && canReadManagerHistory && !!employeeId,
  );

  const allocations = useMemo(() => {
    if (!selected) return [];
    return [...capacityAllocations(selected)]
      .filter((allocation) => !workCategoryId || allocation.workCategoryId === workCategoryId)
      .sort(
        (a, b) =>
          b.fromDate.localeCompare(a.fromDate) ||
          allocationFunctionalUnitLabel(a).localeCompare(allocationFunctionalUnitLabel(b), undefined, {
            sensitivity: 'base',
          }) ||
          allocationTaskLabel(a).localeCompare(allocationTaskLabel(b), undefined, { sensitivity: 'base' }),
      );
  }, [selected, workCategoryId]);

  const allocatedPct = useMemo(
    () => (selected ? averageAllocatedPct(allocations, fromDate, toDate) : 0),
    [selected, allocations, fromDate, toDate],
  );

  const functionalUnits = useMemo(() => {
    const names = new Set(
      allocations.map((allocation) => allocationFunctionalUnitLabel(allocation)),
    );
    return names.size;
  }, [allocations]);

  const setEmployeeId = (nextId: string) => {
    const next = new URLSearchParams(searchParams);
    if (nextId) next.set('employeeId', nextId);
    else next.delete('employeeId');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (!employeeId || !capacity) return;
    if (scopedRows.some((row) => row.employeeId === employeeId)) return;
    const next = new URLSearchParams(searchParams);
    next.delete('employeeId');
    setSearchParams(next, { replace: true });
  }, [scopedRows, employeeId, capacity, searchParams, setSearchParams]);

  if (!showHistory) {
    return <Navigate to="/resources" replace />;
  }

  const fallbackManager = selected?.engineeringManagerName;
  const asOfManager = selected
    ? managerOnDate(canReadManagerHistory ? managerTimeline : undefined, fromDate, fallbackManager)
    : '—';

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <p className="text-text2">
        Select an engineer and date range to see functional unit, manager, and allocations that
        overlap that period.
      </p>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-bg2 p-4">
        <label className="text-sm">
          <span className="text-text2">VP</span>
          <select
            value={vpFilter}
            onChange={(e) => setVpFilter(e.target.value)}
            className="mt-1 block min-w-[12rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm"
          >
            <option value="">All VPs</option>
            {vpOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="text-text2">Engineering manager</span>
          <select
            value={engineeringManagerFilter}
            onChange={(e) => setEngineeringManagerFilter(e.target.value)}
            disabled={locksEmFilter}
            className="mt-1 block min-w-[14rem] max-w-[18rem] rounded-lg border border-border bg-bg3 px-3 py-2 text-sm disabled:opacity-70"
          >
            <option value="">
              {locksEmFilter ? engineeringManagerFilter || 'Your EM team' : 'All engineering managers'}
            </option>
            {(locksEmFilter && engineeringManagerFilter
              ? emOptions.includes(engineeringManagerFilter)
                ? emOptions
                : [engineeringManagerFilter, ...emOptions]
              : emOptions
            ).map((name) => (
              <option key={name} value={name}>
                {name}
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
            {sortedWorkCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.sortOrder != null ? `${category.sortOrder}. ${category.name}` : category.name}
              </option>
            ))}
          </select>
        </label>

        <EngineerSearchSelect
          rows={scopedRows}
          value={employeeId}
          onChange={setEmployeeId}
          isLoading={isLoading}
        />

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

      {error && <p className="text-danger">Failed to load allocation history.</p>}

      {!employeeId && (
        <p className="rounded-xl border border-dashed border-border bg-bg2 px-4 py-8 text-center text-sm text-text2">
          Select an engineer to see allocation history for the chosen dates.
        </p>
      )}

      {employeeId && isLoading && <p className="text-text2">Loading allocation history…</p>}

      {employeeId && !isLoading && !selected && !error && (
        <p className="text-sm text-text2">That engineer is not in the current team view.</p>
      )}

      {selected && (
        <>
          <div>
            <h2 className="text-xl font-semibold">{selected.employeeName}</h2>
            <p className="mt-1 text-sm text-text2">
              {[
                selected.designationName,
                selected.vpName ? `VP: ${selected.vpName}` : null,
                asOfManager !== '—' ? `Manager: ${asOfManager}` : null,
              ]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <HistoryKpi
              label="Allocations"
              value={String(allocations.length)}
              hint={`${fromDate} → ${toDate}`}
            />
            <HistoryKpi
              label="Allocated FTE"
              value={formatFte(allocatedPct / 100)}
              hint={`${Math.round(allocatedPct)}% average in range`}
            />
            <HistoryKpi
              label="Functional units"
              value={String(functionalUnits)}
              hint={asOfManager !== '—' ? `Manager: ${asOfManager}` : undefined}
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-bg2 text-text2">
                <tr>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Functional unit</th>
                  <th className="px-4 py-2 font-medium">Manager</th>
                  <th className="px-4 py-2 font-medium">Allocation</th>
                  <th className="px-4 py-2 font-medium text-right">%</th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((allocation) => (
                  <HistoryRow
                    key={allocation.id}
                    allocation={allocation}
                    manager={managerOnDate(
                      canReadManagerHistory ? managerTimeline : undefined,
                      allocation.fromDate > fromDate ? allocation.fromDate : fromDate,
                      fallbackManager,
                    )}
                  />
                ))}
                {allocations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-text2">
                      No allocations overlap {fromDate} → {toDate}
                      {workCategoryId ? ' for this functional unit' : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-2 text-xs text-text2">
              {allocations.length} allocation{allocations.length !== 1 ? 's' : ''} overlapping the
              selected dates.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function HistoryRow({ allocation, manager }: { allocation: Allocation; manager: string }) {
  const href = allocationTargetHref(allocation);
  const task = allocationTaskLabel(allocation);
  return (
    <tr className="border-t border-border align-top hover:bg-bg2/50">
      <td className="whitespace-nowrap px-4 py-3 text-text2">
        {formatAllocationDateRange(allocation)}
      </td>
      <td className="px-4 py-3">{allocationFunctionalUnitLabel(allocation)}</td>
      <td className="px-4 py-3">{manager}</td>
      <td className="px-4 py-3">
        {href ? (
          <Link to={href} className="font-medium hover:text-accent">
            {task}
          </Link>
        ) : (
          <span className="font-medium">{task}</span>
        )}
        <p className="mt-0.5 text-xs text-text2">
          {[
            allocation.projectId ? allocation.projectName : null,
            allocation.taskTypeName,
            allocation.taskCategoryName,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">{allocation.percentage}%</td>
    </tr>
  );
}
