import { useEffect, useMemo, useState } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useManagerAssignments, useMemberManagerAssignments, useTeamManagement } from '@/hooks/useTeamRoster';
import type { ManagerAssignment } from '@/api/teamRoster.api';
import { partitionManagersByType } from '@/utils/managementRoles';
import { todayLocalIso } from '@/utils/allocationUi';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function formatRange(fromDate?: string | null, toDate?: string | null) {
  const from = fromDate ?? '—';
  const to = toDate ? toDate : 'Current';
  return `${from} → ${to}`;
}

export function TeamHistoryPage() {
  const [asOfInput, setAsOfInput] = useState(todayLocalIso());
  const [asOf, setAsOf] = useState(todayLocalIso());
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [managerId, setManagerId] = useState('');
  const [selected, setSelected] = useState<ManagerAssignment | null>(null);

  const { data: management = [] } = useTeamManagement();
  const { data: rows = [], isLoading, error } = useManagerAssignments({
    asOf,
    search: search || undefined,
    engineeringManagerManagementId: managerId || undefined,
  });
  const { data: timeline = [], isLoading: timelineLoading } = useMemberManagerAssignments(
    selected?.employeeId ?? null,
    !!selected,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setAsOf(asOfInput || todayLocalIso()), 200);
    return () => window.clearTimeout(timer);
  }, [asOfInput]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const managerGroups = useMemo(() => {
    const active = management.filter((person) => (person.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE');
    const groups = partitionManagersByType(active);
    const byName = (a: { fullName: string }, b: { fullName: string }) => a.fullName.localeCompare(b.fullName);
    return {
      engineering: [...groups.engineering].sort(byName),
      delivery: [...groups.delivery].sort(byName),
      coe: [...groups.coe].sort(byName),
    };
  }, [management]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-text2">
        See which engineering manager an employee reported to on a given date. Resource Utilization
        still uses the current manager.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="text-text2">As of</span>
          <input
            type="date"
            value={asOfInput}
            max={todayLocalIso()}
            onChange={(e) => setAsOfInput(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="min-w-[14rem] flex-1 text-sm">
          <span className="text-text2">Search employee</span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name…"
            className={inputClass}
          />
        </label>
        <label className="min-w-[14rem] flex-1 text-sm">
          <span className="text-text2">Engineering manager</span>
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className={inputClass}
          >
            <option value="">All managers</option>
            {managerGroups.engineering.length > 0 && (
              <optgroup label="Engineering Managers">
                {managerGroups.engineering.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName}
                  </option>
                ))}
              </optgroup>
            )}
            {managerGroups.delivery.length > 0 && (
              <optgroup label="Delivery Managers">
                {managerGroups.delivery.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName}
                  </option>
                ))}
              </optgroup>
            )}
            {managerGroups.coe.length > 0 && (
              <optgroup label="COE Managers">
                {managerGroups.coe.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.fullName}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      {error && <p className="text-sm text-danger">Failed to load team history.</p>}
      {isLoading && <p className="text-text2">Loading…</p>}

      {!isLoading && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-bg2 text-text2">
              <tr>
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Designation</th>
                <th className="px-4 py-2 font-medium">Engineering manager</th>
                <th className="px-4 py-2 font-medium">VP</th>
                <th className="px-4 py-2 font-medium">Assignment</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border hover:bg-bg2/50">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="font-medium text-left hover:text-accent"
                    >
                      {row.employeeName}
                    </button>
                  </td>
                  <td className="px-4 py-2 text-text2">
                    {row.designationCode ?? row.designation ?? '—'}
                  </td>
                  <td className="px-4 py-2">{row.engineeringManagerName ?? 'Unassigned'}</td>
                  <td className="px-4 py-2 text-text2">{row.vpName ?? '—'}</td>
                  <td className="px-4 py-2 text-text2">{formatRange(row.fromDate, row.toDate)}</td>
                  <td className="px-4 py-2">{row.status ?? '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text2">
                    No assignments recorded for this date.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-2 text-xs text-text2">
            {rows.length} employee{rows.length !== 1 ? 's' : ''} as of {asOf}
          </p>
        </div>
      )}

      {selected && (
        <SlideOverPanel
          title={selected.employeeName}
          subtitle="Manager assignment history"
          onClose={() => setSelected(null)}
          protectUnsaved={false}
        >
          {timelineLoading && <p className="text-sm text-text2">Loading timeline…</p>}
          {!timelineLoading && (
            <ol className="space-y-3">
              {[...timeline].reverse().map((row) => (
                <li key={row.id} className="rounded-lg border border-border bg-bg2/40 px-3 py-2">
                  <p className="font-medium">{row.engineeringManagerName ?? 'Unassigned'}</p>
                  <p className="text-sm text-text2">{formatRange(row.fromDate, row.toDate)}</p>
                  {row.vpName && <p className="text-xs text-text2">VP: {row.vpName}</p>}
                </li>
              ))}
              {timeline.length === 0 && (
                <p className="text-sm text-text2">No manager history for this employee yet.</p>
              )}
            </ol>
          )}
        </SlideOverPanel>
      )}
    </div>
  );
}
