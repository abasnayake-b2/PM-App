import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { TeamExcelUpload } from '@/components/TeamExcelUpload';
import { TeamRosterMemberPanel } from '@/components/TeamRosterMemberPanel';
import { TeamRosterMemberForm } from '@/components/TeamRosterMemberForm';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import {
  useTeamRosterMembers,
  useCreateTeamRosterMember,
  useUpdateTeamRosterMember,
  useDeleteTeamRosterMember,
  type TeamRosterMemberPayload,
} from '@/hooks/useTeamRoster';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { TeamRosterMember } from '@/api/teamRoster.api';

export function TeamEmployeesPage() {
  const { can } = usePermissions();
  const canEdit = can(P.TEAM_UPDATE) || can(P.TEAM_CREATE);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<TeamRosterMember | null>(null);
  const [selected, setSelected] = useState<TeamRosterMember | null>(null);

  const { data: rows, isLoading, error } = useTeamRosterMembers(search);
  const createRow = useCreateTeamRosterMember();
  const updateRow = useUpdateTeamRosterMember(editing?.id ?? '');
  const deleteRow = useDeleteTeamRosterMember();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
  };

  const openEdit = (row: TeamRosterMember) => {
    setSelected(null);
    setEditing(row);
    setDialog('edit');
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
        {canEdit && (
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
                  {canEdit && <th className="px-4 py-2">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows?.map((row, index) => (
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
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete ${row.fullName}?`)) {
                                deleteRow.mutate(row.id, {
                                  onSuccess: () => {
                                    if (selected?.id === row.id) setSelected(null);
                                  },
                                });
                              }
                            }}
                            className="rounded p-1 text-danger hover:bg-danger/10"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {(rows?.length ?? 0) === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 15 : 14} className="px-4 py-8 text-center text-text2">
                      No employees. Upload a Team Excel file or add manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-text2">
            {rows?.length ?? 0} employee{(rows?.length ?? 0) !== 1 ? 's' : ''}
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

      {dialog && canEdit && (
        <SlideOverPanel
          title={dialog === 'create' ? 'Add employee' : `Edit ${editing?.fullName ?? ''}`}
          subtitle={dialog === 'edit' ? 'Employee roster' : undefined}
          onClose={closeDialog}
          wide
        >
          <TeamRosterMemberForm
            key={editing?.id ?? 'create'}
            initial={editing ?? undefined}
            loading={createRow.isPending || updateRow.isPending}
            onCancel={closeDialog}
            onSubmit={(payload) => {
              if (dialog === 'create') {
                createRow.mutate(payload, { onSuccess: closeDialog });
              } else if (editing) {
                updateRow.mutate(payload, { onSuccess: closeDialog });
              }
            }}
          />
        </SlideOverPanel>
      )}
    </div>
  );
}
