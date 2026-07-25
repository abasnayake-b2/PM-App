import { FormEvent, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import {
  fetchAdminDepartments,
  createAdminDepartment,
  updateAdminDepartment,
  deleteAdminDepartment,
  fetchAdminStreams,
  createAdminStream,
  updateAdminStream,
  deleteAdminStream,
  fetchAdminDesignations,
  createAdminDesignation,
  updateAdminDesignation,
  deleteAdminDesignation,
  fetchAdminWorkTypes,
  createAdminWorkType,
  updateAdminWorkType,
  deleteAdminWorkType,
  fetchAdminSkills,
  createAdminSkill,
  updateAdminSkill,
  deleteAdminSkill,
  fetchAdminIssueTypes,
  createAdminIssueType,
  updateAdminIssueType,
  deleteAdminIssueType,
  fetchAdminStatuses,
  createAdminStatus,
  updateAdminStatus,
  deleteAdminStatus,
  fetchAdminPriorities,
  createAdminPriority,
  updateAdminPriority,
  deleteAdminPriority,
  type ReferenceItem,
} from '@/api/referenceData.api';
import {
  AdminReferenceDetailPanel,
  itemSearchText,
  refDisplayName,
  refItemDepartmentId,
  refItemStreamId,
  type RefTab,
} from '@/components/AdminReferenceDetailPanel';
import { ReferenceDataExcelUpload } from '@/components/ReferenceDataExcelUpload';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

const REF_TABS: { key: RefTab; label: string }[] = [
  { key: 'departments', label: 'Departments' },
  { key: 'streams', label: 'Stream' },
  { key: 'designations', label: 'Designations' },
  { key: 'work-types', label: 'NTP/GBL' },
  { key: 'skills', label: 'Skills' },
  { key: 'issue-types', label: 'Issue types' },
  { key: 'statuses', label: 'Statuses' },
  { key: 'priorities', label: 'Priorities' },
];

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const cellClass = 'whitespace-nowrap px-4 py-2';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail ?? data?.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

type GridColumn = {
  key: string;
  header: string;
  render: (item: ReferenceItem) => string;
};

function gridColumns(tab: RefTab): GridColumn[] {
  switch (tab) {
    case 'departments':
      return [{ key: 'name', header: 'Name', render: (i) => i.name ?? '—' }];
    case 'streams':
      return [
        { key: 'name', header: 'Name', render: (i) => i.name ?? '—' },
        { key: 'department', header: 'Department', render: (i) => i.department?.name ?? i.departmentName ?? '—' },
      ];
    case 'designations':
      return [
        { key: 'name', header: 'Name', render: (i) => i.name ?? '—' },
        { key: 'code', header: 'Code', render: (i) => i.code ?? '—' },
        { key: 'stream', header: 'Stream', render: (i) => i.stream?.name ?? i.streamName ?? '—' },
        { key: 'department', header: 'Department', render: (i) => i.department?.name ?? i.departmentName ?? '—' },
        { key: 'management', header: 'Type', render: (i) => (i.management ? 'Management' : 'Employee') },
      ];
    case 'work-types':
      return [{ key: 'name', header: 'Name', render: (i) => i.name ?? '—' }];
    case 'skills':
      return [
        { key: 'name', header: 'Name', render: (i) => i.name ?? '—' },
        { key: 'description', header: 'Description', render: (i) => i.description ?? '—' },
      ];
    case 'issue-types':
      return [
        { key: 'name', header: 'Name', render: (i) => i.name ?? '—' },
        { key: 'workflow', header: 'Workflow', render: (i) => i.workflowCode ?? '—' },
        { key: 'description', header: 'Description', render: (i) => i.description ?? '—' },
      ];
    case 'statuses':
      return [
        { key: 'name', header: 'Name', render: (i) => i.name ?? '—' },
        { key: 'sequence', header: 'Sequence', render: (i) => String(i.sequence ?? '—') },
        { key: 'terminal', header: 'Terminal', render: (i) => (i.terminal ? 'Yes' : 'No') },
        { key: 'colour', header: 'Colour', render: (i) => i.colour ?? '—' },
      ];
    case 'priorities':
      return [
        { key: 'label', header: 'Label', render: (i) => i.label ?? '—' },
        { key: 'level', header: 'Level', render: (i) => String(i.level ?? '—') },
        { key: 'colour', header: 'Colour', render: (i) => i.colour ?? '—' },
      ];
  }
}

function DepartmentSelect({
  departments,
  defaultValue,
  required = true,
}: {
  departments: ReferenceItem[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-text2">Department</span>
      <select
        name="departmentId"
        required={required}
        defaultValue={defaultValue ?? ''}
        className={inputClass}
      >
        <option value="" disabled>
          Select department…
        </option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function StreamSelect({
  streams,
  defaultValue,
  required = true,
}: {
  streams: ReferenceItem[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-text2">Stream</span>
      <select
        name="streamId"
        required={required}
        defaultValue={defaultValue ?? ''}
        className={inputClass}
      >
        <option value="" disabled>
          Select stream…
        </option>
        {streams.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.department?.name ?? s.departmentName ? ` (${s.department?.name ?? s.departmentName})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function useRefQuery(tab: RefTab) {
  const fetchers: Record<RefTab, () => Promise<ReferenceItem[]>> = {
    departments: fetchAdminDepartments,
    streams: fetchAdminStreams,
    designations: fetchAdminDesignations,
    'work-types': fetchAdminWorkTypes,
    skills: fetchAdminSkills,
    'issue-types': fetchAdminIssueTypes,
    statuses: fetchAdminStatuses,
    priorities: fetchAdminPriorities,
  };
  return useQuery({
    queryKey: ['admin-reference', tab],
    queryFn: fetchers[tab],
  });
}

function ReferenceFormFields({
  tab,
  initial,
  departments,
  streams,
}: {
  tab: RefTab;
  initial?: ReferenceItem;
  departments: ReferenceItem[];
  streams: ReferenceItem[];
}) {
  return (
    <>
      {(tab === 'departments' ||
        tab === 'streams' ||
        tab === 'work-types' ||
        tab === 'skills' ||
        tab === 'statuses') && (
        <label className="block text-sm">
          <span className="text-text2">Name</span>
          <input name="name" required defaultValue={initial?.name ?? ''} className={inputClass} />
        </label>
      )}
      {tab === 'skills' && (
        <label className="block text-sm">
          <span className="text-text2">Description</span>
          <input
            name="description"
            defaultValue={initial?.description ?? ''}
            maxLength={500}
            className={inputClass}
          />
        </label>
      )}
      {tab === 'streams' && (
        <DepartmentSelect departments={departments} defaultValue={refItemDepartmentId(initial)} />
      )}
      {tab === 'designations' && (
        <>
          <label className="block text-sm">
            <span className="text-text2">Name</span>
            <input name="name" required defaultValue={initial?.name ?? ''} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-text2">Code</span>
            <input
              name="code"
              placeholder="e.g. SE"
              defaultValue={initial?.code ?? ''}
              className={inputClass}
            />
          </label>
          {streams.length > 0 ? (
            <StreamSelect streams={streams} defaultValue={refItemStreamId(initial)} />
          ) : (
            <p className="text-sm text-text2">Add a stream first, then create designations.</p>
          )}
          <label className="block text-sm">
            <span className="text-text2">Type</span>
            <select
              name="management"
              className={inputClass}
              defaultValue={initial?.management ? 'true' : 'false'}
            >
              <option value="false">Employee</option>
              <option value="true">Management</option>
            </select>
          </label>
        </>
      )}
      {tab === 'issue-types' && (
        <>
          <label className="block text-sm">
            <span className="text-text2">Name</span>
            <input name="name" required defaultValue={initial?.name ?? ''} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-text2">Workflow code</span>
            <input name="workflowCode" required defaultValue={initial?.workflowCode ?? ''} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-text2">Description</span>
            <input name="description" defaultValue={initial?.description ?? ''} className={inputClass} />
          </label>
        </>
      )}
      {tab === 'statuses' && (
        <>
          <label className="block text-sm">
            <span className="text-text2">Sequence</span>
            <input name="sequence" type="number" defaultValue={initial?.sequence ?? 0} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="terminal" type="checkbox" defaultChecked={initial?.terminal} />
            Terminal status
          </label>
          <label className="block text-sm">
            <span className="text-text2">Colour</span>
            <input name="colour" defaultValue={initial?.colour ?? ''} className={inputClass} />
          </label>
        </>
      )}
      {tab === 'priorities' && (
        <>
          <label className="block text-sm">
            <span className="text-text2">Label</span>
            <input name="label" required defaultValue={initial?.label ?? ''} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-text2">Level</span>
            <input name="level" type="number" defaultValue={initial?.level ?? 1} className={inputClass} />
          </label>
          <label className="block text-sm">
            <span className="text-text2">Colour</span>
            <input name="colour" defaultValue={initial?.colour ?? ''} className={inputClass} />
          </label>
        </>
      )}
    </>
  );
}

export function AdminReferenceSection() {
  const { can } = usePermissions();
  const canImportReference = can(P.REFERENCE_CREATE);
  const [tab, setTab] = useState<RefTab>('departments');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReferenceItem | null>(null);
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<ReferenceItem | null>(null);

  const qc = useQueryClient();
  const { data: items, isLoading, isError, error } = useRefQuery(tab);
  const { data: departments = [] } = useQuery({
    queryKey: ['admin-reference', 'departments'],
    queryFn: fetchAdminDepartments,
    enabled: tab === 'streams' || tab === 'designations' || dialog !== null,
  });
  const { data: streams = [] } = useQuery({
    queryKey: ['admin-reference', 'streams'],
    queryFn: fetchAdminStreams,
    enabled: tab === 'designations' || dialog !== null,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) => itemSearchText(item).includes(q));
  }, [items, search]);

  const columns = gridColumns(tab);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-reference'] });
    qc.invalidateQueries({ queryKey: ['departments'] });
    qc.invalidateQueries({ queryKey: ['streams'] });
    qc.invalidateQueries({ queryKey: ['designations'] });
    qc.invalidateQueries({ queryKey: ['roster-designations'] });
  };

  const saveFromForm = async (fd: FormData, itemId?: string) => {
    const name = (fd.get('name') as string)?.trim();
    switch (tab) {
      case 'departments':
        return itemId ? updateAdminDepartment(itemId, name) : createAdminDepartment(name);
      case 'streams':
        return itemId
          ? updateAdminStream(itemId, name, fd.get('departmentId') as string)
          : createAdminStream(name, fd.get('departmentId') as string);
      case 'designations':
        return itemId
          ? updateAdminDesignation(
              itemId,
              name,
              fd.get('streamId') as string,
              (fd.get('code') as string) || undefined,
              fd.get('management') === 'true',
            )
          : createAdminDesignation(
              name,
              fd.get('streamId') as string,
              (fd.get('code') as string) || undefined,
              fd.get('management') === 'true',
            );
      case 'work-types':
        return itemId ? updateAdminWorkType(itemId, name) : createAdminWorkType(name);
      case 'skills': {
        const description = ((fd.get('description') as string) || '').trim() || undefined;
        return itemId
          ? updateAdminSkill(itemId, name, description)
          : createAdminSkill(name, description);
      }
      case 'issue-types':
        return itemId
          ? updateAdminIssueType(itemId, {
              name,
              workflowCode: (fd.get('workflowCode') as string).trim().toUpperCase(),
              description: (fd.get('description') as string) || undefined,
            })
          : createAdminIssueType({
              name,
              workflowCode: (fd.get('workflowCode') as string).trim().toUpperCase(),
              description: (fd.get('description') as string) || undefined,
            });
      case 'statuses': {
        const payload = {
          name,
          sequence: Number(fd.get('sequence')),
          terminal: fd.get('terminal') === 'on',
          colour: (fd.get('colour') as string) || undefined,
        };
        return itemId ? updateAdminStatus(itemId, payload) : createAdminStatus(payload);
      }
      case 'priorities': {
        const payload = {
          label: (fd.get('label') as string).trim(),
          level: Number(fd.get('level')),
          slaResponseHrs: editing?.slaResponseHrs ?? 24,
          slaResolveHrs: editing?.slaResolveHrs ?? 72,
          colour: (fd.get('colour') as string) || undefined,
        };
        return itemId ? updateAdminPriority(itemId, payload) : createAdminPriority(payload);
      }
    }
  };

  const saveMut = useMutation({
    mutationFn: ({ fd, itemId }: { fd: FormData; itemId?: string }) => saveFromForm(fd, itemId),
    onSuccess: () => {
      setDialog(null);
      setEditing(null);
      setSelected(null);
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      switch (tab) {
        case 'departments':
          return deleteAdminDepartment(id);
        case 'streams':
          return deleteAdminStream(id);
        case 'designations':
          return deleteAdminDesignation(id);
        case 'work-types':
          return deleteAdminWorkType(id);
        case 'skills':
          return deleteAdminSkill(id);
        case 'issue-types':
          return deleteAdminIssueType(id);
        case 'statuses':
          return deleteAdminStatus(id);
        case 'priorities':
          return deleteAdminPriority(id);
      }
    },
    onSuccess: (_, id) => {
      if (selected?.id === id) setSelected(null);
      invalidate();
    },
    onError: (error) => {
      window.alert(apiErrorMessage(error));
    },
  });

  const openEdit = (item: ReferenceItem) => {
    setSelected(null);
    setEditing(item);
    setDialog('edit');
  };

  const closeDialog = () => {
    setDialog(null);
    setEditing(null);
    saveMut.reset();
  };

  const handleSave = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveMut.mutate({ fd: new FormData(e.currentTarget), itemId: editing?.id });
  };

  const formDisabled =
    (tab === 'streams' && !departments.length) ||
    (tab === 'designations' && !streams.length);

  return (
    <div>
      <p className="text-sm text-text2">
        Manage lookup values used across the application. Changes apply immediately.
      </p>

      {canImportReference && tab !== 'skills' && (
        <ReferenceDataExcelUpload onImported={invalidate} />
      )}
      {canImportReference && tab === 'skills' && (
        <ReferenceDataExcelUpload variant="skills" onImported={invalidate} />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {REF_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setSelected(null);
              setSearchInput('');
              setSearch('');
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.key ? 'bg-accent text-[var(--accent-fg)]' : 'border border-border hover:bg-bg3'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="text-text2">Search</span>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text2" size={16} />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-border bg-bg3 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </label>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setDialog('create');
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3"
        >
          <Plus size={16} />
          Add {REF_TABS.find((t) => t.key === tab)?.label?.replace(/s$/, '') ?? 'item'}
        </button>
      </div>

      {isLoading && <p className="mt-4 text-text2">Loading…</p>}

      {isError && (
        <p className="mt-4 text-sm text-danger">
          Failed to load {REF_TABS.find((t) => t.key === tab)?.label?.toLowerCase() ?? 'data'}.
          {(error as Error)?.message ? ` ${(error as Error).message}` : ''}
        </p>
      )}

      {!isLoading && !isError && (
        <div className="mt-4 rounded-xl border border-border">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="w-max min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 shadow-[0_1px_0_var(--border)]">
                <tr className="whitespace-nowrap">
                  <th className="w-12 px-3 py-2 text-center">#</th>
                  {columns.map((col) => (
                    <th key={col.key} className="px-4 py-2">
                      {col.header}
                    </th>
                  ))}
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item, index) => (
                  <tr key={item.id} className="border-t border-border hover:bg-bg2/50">
                    <td className={`${cellClass} text-center text-xs tabular-nums text-text2`}>{index + 1}</td>
                    {columns.map((col, colIndex) => (
                      <td key={col.key} className={cellClass}>
                        {colIndex === 0 ? (
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            className="max-w-[240px] truncate font-medium text-accent hover:underline"
                            title={col.render(item)}
                          >
                            {col.render(item)}
                          </button>
                        ) : (
                          <span className="text-text2">{col.render(item)}</span>
                        )}
                      </td>
                    ))}
                    <td className={cellClass}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded p-1 text-text2 hover:bg-bg3"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete "${refDisplayName(item)}"?`)) {
                              deleteMut.mutate(item.id);
                            }
                          }}
                          className="rounded p-1 text-danger hover:bg-danger/10"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="px-4 py-8 text-center text-text2">
                      {search ? `No matches for "${search}".` : 'No entries yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-xs text-text2">
            {filteredItems.length} record{filteredItems.length !== 1 ? 's' : ''}
            {search ? ` matching "${search}"` : ''}
          </p>
        </div>
      )}

      {selected && (
        <AdminReferenceDetailPanel
          tab={tab}
          item={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
        />
      )}

      {dialog && (
        <SlideOverPanel
          title={
            dialog === 'create'
              ? `Add ${REF_TABS.find((t) => t.key === tab)?.label}`
              : `Edit ${refDisplayName(editing!)}`
          }
          subtitle="Reference data"
          onClose={closeDialog}
          wide
        >
          <form onSubmit={handleSave} className="space-y-3">
            {saveMut.isError && (
              <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {apiErrorMessage(saveMut.error)}
              </p>
            )}
            <ReferenceFormFields
              tab={tab}
              initial={editing ?? undefined}
              departments={departments}
              streams={streams}
            />
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saveMut.isPending || formDisabled}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
                style={{ color: 'var(--accent-fg)' }}
              >
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" onClick={closeDialog} className="rounded-lg border border-border px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        </SlideOverPanel>
      )}
    </div>
  );
}
