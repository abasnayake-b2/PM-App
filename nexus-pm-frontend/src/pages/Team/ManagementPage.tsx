import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { ArrowDownLeft, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { TeamExcelUpload } from '@/components/TeamExcelUpload';
import { TeamManagementPanel } from '@/components/TeamManagementPanel';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import {
  useTeamManagement,
  useCreateTeamManagement,
  useUpdateTeamManagement,
  useDeleteTeamManagement,
  useUploadTeamManagementPhoto,
  useDeleteTeamManagementPhoto,
  useDemoteManagementToEmployee,
  type TeamManagementPayload,
} from '@/hooks/useTeamRoster';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import { EMPLOYMENT_TYPE_OPTIONS } from '@/utils/employmentType';
import { useDepartments } from '@/hooks/useEmployees';
import type { TeamManagement } from '@/api/teamRoster.api';
import { partitionManagementRoster, partitionManagersByType } from '@/utils/managementRoles';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail || data?.message || error.message || 'Request failed';
  }
  return 'Request failed';
}

function DemoteToEmployeeForm({
  member,
  managers,
  loading,
  error,
  onCancel,
  onSubmit,
}: {
  member: TeamManagement;
  managers: TeamManagement[];
  loading?: boolean;
  error?: unknown;
  onCancel: () => void;
  onSubmit: (payload: { engineeringManagerManagementId?: string }) => void;
}) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const engineeringManagerManagementId =
      (fd.get('engineeringManagerManagementId') as string) || undefined;
    onSubmit({ engineeringManagerManagementId });
  };

  const candidates = managers.filter(
    (m) => m.id !== member.id && (m.status ?? 'ACTIVE').toUpperCase() !== 'INACTIVE',
  );
  const groups = partitionManagersByType(candidates);
  const byName = (a: TeamManagement, b: TeamManagement) => a.fullName.localeCompare(b.fullName);
  const engineering = [...groups.engineering].sort(byName);
  const delivery = [...groups.delivery].sort(byName);
  const coe = [...groups.coe].sort(byName);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error != null && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {apiErrorMessage(error)}
        </div>
      )}
      <p className="text-sm text-text2">
        Move <span className="font-medium text-text">{member.fullName}</span> back to the employee
        roster. They will leave Management and appear under Employees. If they have a login, their
        app role becomes Employee.
      </p>
      <label className="block text-sm">
        <span className="text-text2">Manager (optional)</span>
        <select name="engineeringManagerManagementId" className={inputClass} defaultValue="">
          <option value="">None</option>
          {engineering.length > 0 && (
            <optgroup label="Engineering Managers">
              {engineering.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} — {m.roleTitle}
                </option>
              ))}
            </optgroup>
          )}
          {delivery.length > 0 && (
            <optgroup label="Delivery Managers">
              {delivery.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} — {m.roleTitle}
                </option>
              ))}
            </optgroup>
          )}
          {coe.length > 0 && (
            <optgroup label="COE Managers">
              {coe.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName} — {m.roleTitle}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Moving…' : 'Move to employee'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ManagementForm({
  initial,
  supervisors,
  loading,
  onCancel,
  onSubmit,
}: {
  initial?: TeamManagement;
  supervisors: TeamManagement[];
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (payload: TeamManagementPayload) => void;
}) {
  const { data: departments = [] } = useDepartments();
  const memberId = initial?.id ?? '';
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '');
  const [pictureUrl, setPictureUrl] = useState<string | null | undefined>(initial?.profilePictureUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadTeamManagementPhoto(memberId);
  const deletePhoto = useDeleteTeamManagementPhoto(memberId);

  useEffect(() => {
    setPictureUrl(initial?.profilePictureUrl);
    setPhotoError(null);
    setDepartmentId(initial?.departmentId ?? '');
  }, [initial?.id, initial?.profilePictureUrl, initial?.departmentId]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      roleTitle: (fd.get('roleTitle') as string).trim(),
      firstName: (fd.get('firstName') as string).trim(),
      lastName: (fd.get('lastName') as string).trim(),
      supervisorName: (fd.get('supervisorName') as string).trim() || undefined,
      supervisorId: (fd.get('supervisorId') as string) || undefined,
      status: (fd.get('status') as string) || 'ACTIVE',
      employmentType: (fd.get('employmentType') as string)?.trim() || undefined,
      departmentId: (fd.get('departmentId') as string) || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {memberId ? (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-bg3 p-3">
          <ResourceAvatar
            name={initial?.fullName ?? 'Management'}
            size="lg"
            imageUrl={pictureUrl}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-medium">Profile picture</p>
            <p className="text-xs text-text2">JPG, PNG, WEBP or GIF · max 2 MB</p>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setPhotoError(null);
                  uploadPhoto.mutate(file, {
                    onSuccess: (row) => setPictureUrl(row.profilePictureUrl),
                    onError: (err) => {
                      setPhotoError(
                        isAxiosError(err)
                          ? ((err.response?.data as { detail?: string })?.detail ??
                            'Failed to upload picture.')
                          : 'Failed to upload picture.',
                      );
                    },
                  });
                }}
              />
              <button
                type="button"
                disabled={uploadPhoto.isPending || deletePhoto.isPending}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                {uploadPhoto.isPending
                  ? 'Uploading…'
                  : pictureUrl
                    ? 'Update picture'
                    : 'Add picture'}
              </button>
              {pictureUrl && (
                <button
                  type="button"
                  disabled={uploadPhoto.isPending || deletePhoto.isPending}
                  onClick={() => {
                    setPhotoError(null);
                    deletePhoto.mutate(undefined, {
                      onSuccess: () => setPictureUrl(null),
                      onError: (err) => {
                        setPhotoError(
                          isAxiosError(err)
                            ? ((err.response?.data as { detail?: string })?.detail ??
                              'Failed to delete picture.')
                            : 'Failed to delete picture.',
                        );
                      },
                    });
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-bg2 disabled:opacity-50"
                >
                  {deletePhoto.isPending ? 'Removing…' : 'Delete picture'}
                </button>
              )}
            </div>
            {photoError && <p className="text-xs text-danger">{photoError}</p>}
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-bg3 px-3 py-2 text-xs text-text2">
          Save the management record first, then you can add a profile picture.
        </p>
      )}

      <label className="block text-sm">
        <span className="text-text2">Role</span>
        <input name="roleTitle" required defaultValue={initial?.roleTitle} className={inputClass} />
      </label>
      <label className="block text-sm">
        <span className="text-text2">Department</span>
        <select
          name="departmentId"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          className={inputClass}
        >
          <option value="">Select department…</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">First name</span>
          <input name="firstName" required defaultValue={initial?.firstName} className={inputClass} />
        </label>
        <label className="block text-sm">
          <span className="text-text2">Last name</span>
          <input name="lastName" required defaultValue={initial?.lastName} className={inputClass} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-text2">Supervisor (text)</span>
        <input name="supervisorName" defaultValue={initial?.supervisorName ?? ''} className={inputClass} />
      </label>
      <label className="block text-sm">
        <span className="text-text2">Supervisor (linked)</span>
        <select name="supervisorId" defaultValue={initial?.supervisorId ?? ''} className={inputClass}>
          <option value="">None</option>
          {supervisors
            .filter((s) => s.id !== initial?.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} — {s.roleTitle}
              </option>
            ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-text2">Employment type</span>
          <select
            name="employmentType"
            defaultValue={initial?.employmentType ?? ''}
            className={inputClass}
          >
            <option value="">Select employment type…</option>
            {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-text2">Status</span>
          <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className={inputClass}>
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </select>
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

function ManagementRosterGrid({
  title,
  description,
  rows,
  emptyMessage,
  search,
  canManageHierarchy,
  canDemote,
  onSelect,
  onEdit,
  onDemote,
  onDeactivate,
}: {
  title: string;
  description: string;
  rows: TeamManagement[];
  emptyMessage: string;
  search: string;
  canManageHierarchy: boolean;
  canDemote: boolean;
  onSelect: (row: TeamManagement) => void;
  onEdit: (row: TeamManagement) => void;
  onDemote: (row: TeamManagement) => void;
  onDeactivate: (row: TeamManagement) => void;
}) {
  const cellClass = 'whitespace-nowrap px-4 py-2';
  const colCount = canManageHierarchy ? 10 : 9;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-text2">{description}</p>
      </div>
      <div className="rounded-xl border border-border">
        <div className="max-h-[min(50vh,520px)] overflow-auto">
          <table className="w-max min-w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
              <tr className="whitespace-nowrap">
                <th className="w-12 px-3 py-2 text-center">#</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2">First name</th>
                <th className="px-4 py-2">Last name</th>
                <th className="px-4 py-2">Supervisor</th>
                <th className="px-4 py-2">Employment</th>
                <th className="px-4 py-2">Status</th>
                {canManageHierarchy && <th className="px-4 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-t border-border hover:bg-bg2/50">
                  <td className={`${cellClass} text-center text-xs tabular-nums text-text2`}>{index + 1}</td>
                  <td className={cellClass}>
                    <button
                      type="button"
                      onClick={() => onSelect(row)}
                      className="max-w-[220px] truncate font-medium text-accent hover:underline"
                      title={row.fullName}
                    >
                      {row.fullName}
                    </button>
                  </td>
                  <td className={cellClass}>{row.roleTitle}</td>
                  <td className={`${cellClass} text-text2`}>{row.departmentName ?? '—'}</td>
                  <td className={cellClass}>{row.firstName}</td>
                  <td className={cellClass}>{row.lastName}</td>
                  <td className={`${cellClass} text-text2`}>
                    {row.supervisorFullName ?? row.supervisorName ?? '—'}
                  </td>
                  <td className={`${cellClass} text-text2`}>{row.employmentType ?? '—'}</td>
                  <td className={cellClass}>{row.status}</td>
                  {canManageHierarchy && (
                    <td className={cellClass}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="rounded p-1 text-text2 hover:bg-bg3"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        {canDemote && (
                          <button
                            type="button"
                            onClick={() => onDemote(row)}
                            className="rounded p-1 text-text2 hover:bg-bg3 hover:text-accent"
                            title="Move to employee"
                          >
                            <ArrowDownLeft size={16} />
                          </button>
                        )}
                        {row.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => onDeactivate(row)}
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
              {rows.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-text2">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-2 text-xs text-text2">
          {rows.length} {title.toLowerCase()} record{rows.length !== 1 ? 's' : ''}
          {search ? ` matching "${search}"` : ''}
        </p>
      </div>
    </section>
  );
}

export function ManagementPage() {
  const { can } = usePermissions();
  const canManageHierarchy = can(P.TEAM_CREATE);
  const canDemote = can(P.TEAM_CREATE);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | 'demote' | null>(null);
  const [editing, setEditing] = useState<TeamManagement | null>(null);
  const [selected, setSelected] = useState<TeamManagement | null>(null);
  const [demoting, setDemoting] = useState<TeamManagement | null>(null);

  const { data: rows, isLoading, error } = useTeamManagement(search, true, true);
  const createRow = useCreateTeamManagement();
  const updateRow = useUpdateTeamManagement(editing?.id ?? '');
  const deleteRow = useDeleteTeamManagement();
  const demoteRow = useDemoteManagementToEmployee();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
    setDemoting(null);
  };

  const openEdit = (row: TeamManagement) => {
    setSelected(null);
    setEditing(row);
    setDialog('edit');
  };

  const openDemote = (row: TeamManagement) => {
    setSelected(null);
    setDemoting(row);
    setDialog('demote');
  };

  const handleDeactivate = (row: TeamManagement) => {
    if (
      !window.confirm(
        `Deactivate ${row.fullName}? They will be marked inactive${
          row.email ? ' and any linked login will be disabled' : ''
        }.`,
      )
    ) {
      return;
    }
    deleteRow.mutate(row.id, {
      onSuccess: () => {
        if (selected?.id === row.id) setSelected(null);
      },
      onError: (err) => {
        const message = isAxiosError(err)
          ? (err.response?.data as { detail?: string })?.detail || err.message
          : 'Failed to deactivate management record.';
        window.alert(message);
      },
    });
  };

  const groups = useMemo(() => partitionManagementRoster(rows ?? []), [rows]);
  const gridProps = {
    search,
    canManageHierarchy,
    canDemote,
    onSelect: setSelected,
    onEdit: openEdit,
    onDemote: openDemote,
    onDeactivate: handleDeactivate,
  };

  return (
    <div className="space-y-6">
      <TeamExcelUpload variant="management" />

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
                placeholder="Name, role, supervisor…"
                className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </label>
        </div>
        {canManageHierarchy && (
          <button
            type="button"
            onClick={() => setDialog('create')}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
          >
            <Plus size={16} />
            Add management
          </button>
        )}
      </div>

      {isLoading && <p className="text-text2">Loading management…</p>}
      {error && <p className="text-danger">Failed to load management roster.</p>}

      {!isLoading && !error && (
        <div className="space-y-8">
          <ManagementRosterGrid
            title="C-level"
            description="CEO, COO, CTO, CPO, CXO, and other chief roles."
            rows={groups.cLevel}
            emptyMessage={
              search ? `No C-level records matching "${search}".` : 'No C-level records yet.'
            }
            {...gridProps}
          />
          <ManagementRosterGrid
            title="VP"
            description="Vice presidents and VP-level roles."
            rows={groups.vp}
            emptyMessage={search ? `No VP records matching "${search}".` : 'No VP records yet.'}
            {...gridProps}
          />
          <ManagementRosterGrid
            title="Engineering Managers"
            description="Software engineering managers, SEM / Sr SEM, and similar engineering management roles."
            rows={groups.engineering}
            emptyMessage={
              search
                ? `No engineering manager records matching "${search}".`
                : 'No engineering manager records yet.'
            }
            {...gridProps}
          />
          <ManagementRosterGrid
            title="Delivery Managers"
            description="Software delivery managers and other delivery management roles."
            rows={groups.delivery}
            emptyMessage={
              search
                ? `No delivery manager records matching "${search}".`
                : 'No delivery manager records yet.'
            }
            {...gridProps}
          />
          <ManagementRosterGrid
            title="COE Managers"
            description="COE managers and Center of Excellence management roles."
            rows={groups.coe}
            emptyMessage={
              search
                ? `No COE manager records matching "${search}".`
                : 'No COE manager records yet.'
            }
            {...gridProps}
          />
          {groups.other.length > 0 && (
            <ManagementRosterGrid
              title="Other"
              description="Management records that do not match C-level, VP, engineering manager, delivery manager, or COE manager titles."
              rows={groups.other}
              emptyMessage=""
              {...gridProps}
            />
          )}
        </div>
      )}

      {selected && (
        <TeamManagementPanel
          member={selected}
          canEdit={canManageHierarchy}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      )}

      {(dialog === 'create' || dialog === 'edit') && canManageHierarchy && (
        <SlideOverPanel
          title={dialog === 'create' ? 'Add management' : `Edit ${editing?.fullName ?? ''}`}
          subtitle={dialog === 'edit' ? 'Management roster' : undefined}
          onClose={closeDialog}
          wide
        >
          <ManagementForm
            initial={editing ?? undefined}
            supervisors={rows ?? []}
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

      {dialog === 'demote' && canDemote && demoting && (
        <SlideOverPanel
          title={`Move ${demoting.fullName} to employee`}
          subtitle="Management → employee roster"
          onClose={closeDialog}
        >
          <DemoteToEmployeeForm
            member={demoting}
            managers={rows ?? []}
            loading={demoteRow.isPending}
            error={demoteRow.error}
            onCancel={closeDialog}
            onSubmit={(payload) => {
              demoteRow.reset();
              demoteRow.mutate(
                {
                  managementId: demoting.id,
                  payload: {
                    engineeringManagerManagementId: payload.engineeringManagerManagementId,
                    setEmployeeRole: true,
                  },
                },
                {
                  onSuccess: () => {
                    if (selected?.id === demoting.id) setSelected(null);
                    closeDialog();
                  },
                },
              );
            }}
          />
        </SlideOverPanel>
      )}
    </div>
  );
}
