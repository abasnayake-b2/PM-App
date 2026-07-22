import { FormEvent, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
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
  type TeamManagementPayload,
} from '@/hooks/useTeamRoster';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import type { TeamManagement } from '@/api/teamRoster.api';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

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
  const memberId = initial?.id ?? '';
  const [pictureUrl, setPictureUrl] = useState<string | null | undefined>(initial?.profilePictureUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadPhoto = useUploadTeamManagementPhoto(memberId);
  const deletePhoto = useDeleteTeamManagementPhoto(memberId);

  useEffect(() => {
    setPictureUrl(initial?.profilePictureUrl);
    setPhotoError(null);
  }, [initial?.id, initial?.profilePictureUrl]);

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
      <label className="block text-sm">
        <span className="text-text2">Status</span>
        <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className={inputClass}>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
        </select>
      </label>
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

export function ManagementPage() {
  const { can } = usePermissions();
  const canManageHierarchy = can(P.TEAM_CREATE);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<TeamManagement | null>(null);
  const [selected, setSelected] = useState<TeamManagement | null>(null);

  const { data: rows, isLoading, error } = useTeamManagement(search);
  const createRow = useCreateTeamManagement();
  const updateRow = useUpdateTeamManagement(editing?.id ?? '');
  const deleteRow = useDeleteTeamManagement();

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
  };

  const openEdit = (row: TeamManagement) => {
    setSelected(null);
    setEditing(row);
    setDialog('edit');
  };

  const cellClass = 'whitespace-nowrap px-4 py-2';

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
        <div className="rounded-xl border border-border">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-max min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
                <tr className="whitespace-nowrap">
                  <th className="w-12 px-3 py-2 text-center">#</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">First name</th>
                  <th className="px-4 py-2">Last name</th>
                  <th className="px-4 py-2">Supervisor</th>
                  <th className="px-4 py-2">Status</th>
                  {canManageHierarchy && <th className="px-4 py-2">Actions</th>}
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
                    <td className={cellClass}>{row.roleTitle}</td>
                    <td className={cellClass}>{row.firstName}</td>
                    <td className={cellClass}>{row.lastName}</td>
                    <td className={`${cellClass} text-text2`}>
                      {row.supervisorFullName ?? row.supervisorName ?? '—'}
                    </td>
                    <td className={cellClass}>{row.status}</td>
                    {canManageHierarchy && (
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
                              if (
                                window.confirm(
                                  `Delete ${row.fullName}?\n\nProjects where they are VP or Engineering Manager will have those assignments cleared.\nIf they have a login, it will be deactivated.`,
                                )
                              ) {
                                deleteRow.mutate(row.id, {
                                  onSuccess: () => {
                                    if (selected?.id === row.id) setSelected(null);
                                  },
                                  onError: (err) => {
                                    const message = isAxiosError(err)
                                      ? (err.response?.data as { detail?: string })?.detail ||
                                        err.message
                                      : 'Failed to delete management record.';
                                    window.alert(message);
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
                    <td colSpan={canManageHierarchy ? 8 : 7} className="px-4 py-8 text-center text-text2">
                      No management records. Upload a Management Excel file or add manually.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-text2">
            {rows?.length ?? 0} management record{(rows?.length ?? 0) !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
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

      {dialog && canManageHierarchy && (
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
    </div>
  );
}
