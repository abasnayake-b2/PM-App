import { FormEvent, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { TeamExcelUpload } from '@/components/TeamExcelUpload';
import { TeamRosterMemberPanel } from '@/components/TeamRosterMemberPanel';
import { TeamRosterMemberForm } from '@/components/TeamRosterMemberForm';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import {
  useTeamRosterMembers,
  useCreateTeamRosterMember,
  useUpdateTeamRosterMember,
  useDeleteTeamRosterMember,
  usePromoteEmployeeToManagement,
  useTeamManagement,
  type TeamRosterMemberPayload,
} from '@/hooks/useTeamRoster';
import { fetchRosterDesignations, type RosterDesignation } from '@/api/rosterLookups.api';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { TeamRosterMember } from '@/api/teamRoster.api';
import type { PromoteEmployeeToManagementPayload } from '@/api/teamRoster.api';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail || data?.message || error.message || 'Request failed';
  }
  return 'Request failed';
}

/** Map a management designation to an app role when the person already has a login. */
function appRoleFromDesignation(d: RosterDesignation): string {
  const code = (d.code ?? '').toUpperCase();
  if (code === 'CXO' || code === 'CTO') return 'CXO';
  if (code === 'VP' || code === 'VP_ENG') return 'VP';
  if (code === 'PM') return 'PM';
  if (code === 'DM') return 'DM';
  return 'MANAGER';
}

function PromoteToManagementForm({
  member,
  supervisors,
  loading,
  error,
  onCancel,
  onSubmit,
}: {
  member: TeamRosterMember;
  supervisors: { id: string; fullName: string; roleTitle: string }[];
  loading?: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (payload: PromoteEmployeeToManagementPayload) => void;
}) {
  const { data: designations = [], isLoading: designationsLoading } = useQuery({
    queryKey: ['roster-designations'],
    queryFn: fetchRosterDesignations,
  });

  const managementDesignations = useMemo(
    () =>
      designations
        .filter((d) => d.management)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [designations],
  );

  const [designationId, setDesignationId] = useState('');

  useEffect(() => {
    if (designationId) return;
    const preferred =
      managementDesignations.find((d) => (d.code ?? '').toUpperCase() === 'EM')?.id ??
      managementDesignations.find((d) => /manager/i.test(d.name))?.id ??
      managementDesignations[0]?.id ??
      '';
    if (preferred) setDesignationId(preferred);
  }, [managementDesignations, designationId]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const selected = managementDesignations.find((d) => d.id === designationId);
    if (!selected) return;
    const supervisorId = (fd.get('supervisorId') as string) || undefined;
    onSubmit({
      roleTitle: selected.name,
      roleCode: appRoleFromDesignation(selected),
      supervisorId,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error != null && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(error)}
        </div>
      )}
      <p className="text-sm text-text2">
        Move <span className="font-medium text-text">{member.fullName}</span> onto the management
        roster. They will leave the Employees list and appear under Management. You can move them
        back to Employees from the Management page anytime.
      </p>
      <label className="block text-sm">
        <span className="text-text2">Management role</span>
        <select
          name="designationId"
          required
          className={inputClass}
          value={designationId}
          onChange={(e) => setDesignationId(e.target.value)}
          disabled={designationsLoading || managementDesignations.length === 0}
        >
          {designationsLoading && <option value="">Loading designations…</option>}
          {!designationsLoading && managementDesignations.length === 0 && (
            <option value="">No management designations</option>
          )}
          {managementDesignations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.code ? `${d.name} (${d.code})` : d.name}
            </option>
          ))}
        </select>
        {!designationsLoading && managementDesignations.length === 0 && (
          <p className="mt-1 text-xs text-text2">
            Mark designations as Management under Admin → Reference data → Designations.
          </p>
        )}
      </label>
      <label className="block text-sm">
        <span className="text-text2">Supervisor (management)</span>
        <select name="supervisorId" className={inputClass} defaultValue="">
          <option value="">None</option>
          {supervisors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName} — {s.roleTitle}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading || managementDesignations.length === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Moving…' : 'Move to management'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

export function TeamEmployeesPage() {
  const { can } = usePermissions();
  const canEdit = can(P.TEAM_UPDATE) || can(P.TEAM_CREATE);
  const canPromote = can(P.TEAM_CREATE);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusTab, setStatusTab] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [dialog, setDialog] = useState<'create' | 'edit' | 'promote' | null>(null);
  const [editing, setEditing] = useState<TeamRosterMember | null>(null);
  const [selected, setSelected] = useState<TeamRosterMember | null>(null);
  const [promoting, setPromoting] = useState<TeamRosterMember | null>(null);

  const { data: rows, isLoading, error } = useTeamRosterMembers(search);
  const { data: management = [] } = useTeamManagement('', canPromote && dialog === 'promote');
  const createRow = useCreateTeamRosterMember();
  const updateRow = useUpdateTeamRosterMember(editing?.id ?? '');
  const deleteRow = useDeleteTeamRosterMember();
  const promoteRow = usePromoteEmployeeToManagement();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { activeRows, inactiveRows, visibleRows } = useMemo(() => {
    const list = rows ?? [];
    const active = list.filter((row) => (row.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE');
    const inactive = list.filter((row) => (row.status ?? '').toUpperCase() === 'INACTIVE');
    return {
      activeRows: active,
      inactiveRows: inactive,
      visibleRows: statusTab === 'INACTIVE' ? inactive : active,
    };
  }, [rows, statusTab]);

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
    setPromoting(null);
  };

  const openEdit = (row: TeamRosterMember) => {
    setSelected(null);
    setEditing(row);
    setDialog('edit');
  };

  const openPromote = (row: TeamRosterMember) => {
    setSelected(null);
    setPromoting(row);
    setDialog('promote');
  };

  const cellClass = 'whitespace-nowrap px-4 py-2';

  return (
    <div className="space-y-6">
      <TeamExcelUpload variant="employees" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-1 items-end gap-3 min-w-[12rem]">
          <label className="flex-1 text-sm">
            <span className="text-text2">Search</span>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, VP, EM, designation, team, skills, product, country…"
                className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>
        </div>
        {canEdit && statusTab === 'ACTIVE' && (
          <button
            type="button"
            onClick={() => setDialog('create')}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
          >
            <Plus size={16} />
            Add employee
          </button>
        )}
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-6">
          {(
            [
              { key: 'ACTIVE' as const, label: 'Active', count: activeRows.length },
              { key: 'INACTIVE' as const, label: 'Inactive', count: inactiveRows.length },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusTab(tab.key)}
              className={`border-b-2 pb-3 text-sm font-medium transition ${
                statusTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text2 hover:text-text'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 tabular-nums text-text2">({tab.count})</span>
            </button>
          ))}
        </nav>
      </div>

      {isLoading && <p className="text-text2">Loading employees…</p>}
      {error && <p className="text-danger">Failed to load employee roster.</p>}

      {!isLoading && !error && (
        <div className="rounded-xl border border-border">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-max min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
                <tr className="whitespace-nowrap">
                  <th className="w-12 px-3 py-2 text-center">#</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Designation</th>
                  <th className="px-4 py-2">Team</th>
                  <th className="px-4 py-2">EM</th>
                  <th className="px-4 py-2">NTP/GBL</th>
                  <th className="px-4 py-2">Country</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Skills</th>
                  <th className="px-4 py-2">Exp. total</th>
                  <th className="px-4 py-2">DFN</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Tel</th>
                  <th className="px-4 py-2">Employment</th>
                  <th className="px-4 py-2">Status</th>
                  {canEdit && <th className="px-4 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => (
                  <tr key={row.id} className="border-t border-border hover:bg-bg2/50">
                    <td className={`${cellClass} text-center text-xs tabular-nums text-text2`}>{index + 1}</td>
                    <td className={cellClass}>
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="max-w-[220px] truncate font-medium text-accent hover:underline"
                        title={row.fullName}
                      >
                        {row.fullName}
                      </button>
                      {row.managementRoleTitle && (
                        <div className="text-xs text-text2">Mgmt: {row.managementRoleTitle}</div>
                      )}
                    </td>
                    <td className={`${cellClass} text-text2`}>{row.designationCode ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.designation ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.teamName ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.engineeringManagerName ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.workType ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.country ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.product ?? '—'}</td>
                    <td
                      className={`${cellClass} max-w-[180px] truncate text-text2`}
                      title={row.skillNames?.length ? row.skillNames.join(', ') : undefined}
                    >
                      {row.skillNames?.length ? row.skillNames.join(', ') : '—'}
                    </td>
                    <td className={`${cellClass} text-text2`}>
                      {row.totalYearsOfExperience != null ? row.totalYearsOfExperience : '—'}
                    </td>
                    <td className={`${cellClass} text-text2`}>
                      {row.experienceInDfn != null ? row.experienceInDfn : '—'}
                    </td>
                    <td className={`${cellClass} text-text2`}>{row.email ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.phone ?? '—'}</td>
                    <td className={`${cellClass} text-text2`}>{row.employmentType ?? '—'}</td>
                    <td className={cellClass}>{row.status ?? '—'}</td>
                    {canEdit && (
                      <td className={cellClass}>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded p-1 text-text2 hover:bg-bg3"
                            title="Edit"
                          >
                            <Pencil size={16} />
                          </button>
                          {statusTab === 'ACTIVE' && canPromote && !row.managementId && (
                            <button
                              type="button"
                              onClick={() => openPromote(row)}
                              className="rounded p-1 text-text2 hover:bg-bg3 hover:text-accent"
                              title="Move to management"
                            >
                              <ArrowUpRight size={16} />
                            </button>
                          )}
                          {statusTab === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Deactivate ${row.fullName}? They will be marked inactive and any linked login will be disabled.`,
                                )
                              ) {
                                deleteRow.mutate(row.id, {
                                  onSuccess: () => {
                                    if (selected?.id === row.id) setSelected(null);
                                  },
                                });
                              }
                            }}
                            className="rounded p-1 text-danger hover:bg-danger/10"
                            title="Deactivate"
                          >
                            <Trash2 size={16} />
                          </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 17 : 16} className="px-4 py-8 text-center text-text2">
                      {statusTab === 'INACTIVE'
                        ? 'No inactive employees.'
                        : 'No active employees. Upload a Team Excel file or add manually.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-text2">
            {visibleRows.length} {statusTab === 'INACTIVE' ? 'inactive' : 'active'} employee
            {visibleRows.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
        </div>
      )}

      {selected && (
        <TeamRosterMemberPanel
          member={selected}
          canEdit={canEdit}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      )}

      {dialog === 'create' && canEdit && (
        <SlideOverPanel title="Add employee" onClose={closeDialog} wide>
          <TeamRosterMemberForm
            key="create"
            loading={createRow.isPending}
            onCancel={closeDialog}
            onSubmit={(payload) => {
              createRow.mutate(payload, { onSuccess: closeDialog });
            }}
          />
        </SlideOverPanel>
      )}

      {dialog === 'edit' && canEdit && editing && (
        <SlideOverPanel
          title={`Edit ${editing.fullName}`}
          subtitle="Employee roster"
          onClose={closeDialog}
          wide
        >
          <TeamRosterMemberForm
            key={editing.id}
            initial={editing}
            loading={updateRow.isPending}
            onCancel={closeDialog}
            onSubmit={(payload: TeamRosterMemberPayload) => {
              updateRow.mutate(payload, { onSuccess: closeDialog });
            }}
          />
        </SlideOverPanel>
      )}

      {dialog === 'promote' && canPromote && promoting && (
        <SlideOverPanel
          title={`Move ${promoting.fullName} to management`}
          subtitle="Employee → management roster"
          onClose={closeDialog}
        >
          <PromoteToManagementForm
            member={promoting}
            supervisors={management}
            loading={promoteRow.isPending}
            error={promoteRow.error}
            onCancel={closeDialog}
            onSubmit={(payload) => {
              promoteRow.reset();
              promoteRow.mutate(
                { employeeId: promoting.id, payload },
                { onSuccess: closeDialog },
              );
            }}
          />
        </SlideOverPanel>
      )}
    </div>
  );
}
