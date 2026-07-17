import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAdminIssueField,
  deleteAdminIssueField,
  fetchAdminIssueFields,
  updateAdminIssueField,
  type IssueFieldDefinition,
} from '@/api/issueFields.api';
import { ISSUE_FIELD_SECTION_LABELS } from '@/components/IssueCustomFields';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

const inputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const DATA_TYPES = ['TEXT', 'NUMBER', 'DATE', 'YEAR', 'DROPDOWN'] as const;

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail ?? data?.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

type Draft = {
  label: string;
  fieldKey: string;
  dataType: string;
  maxLength: string;
  required: boolean;
  active: boolean;
  sectionCode: string;
  displayOrder: string;
  optionsText: string;
  helpText: string;
};

const emptyDraft = (): Draft => ({
  label: '',
  fieldKey: '',
  dataType: 'TEXT',
  maxLength: '',
  required: false,
  active: true,
  sectionCode: 'OTHER',
  displayOrder: '1000',
  optionsText: '',
  helpText: '',
});

function draftFromField(field: IssueFieldDefinition): Draft {
  return {
    label: field.label,
    fieldKey: field.fieldKey,
    dataType: field.dataType,
    maxLength: field.maxLength != null ? String(field.maxLength) : '',
    required: field.required,
    active: field.active,
    sectionCode: field.sectionCode ?? 'OTHER',
    displayOrder: String(field.displayOrder ?? 0),
    optionsText: (field.options ?? []).join(', '),
    helpText: field.helpText ?? '',
  };
}

function toPayload(draft: Draft) {
  const options =
    draft.dataType === 'DROPDOWN'
      ? draft.optionsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
  return {
    label: draft.label.trim(),
    fieldKey: draft.fieldKey.trim() || undefined,
    dataType: draft.dataType,
    maxLength: draft.maxLength.trim() ? Number(draft.maxLength) : null,
    required: draft.required,
    active: draft.active,
    sectionCode: draft.sectionCode.trim() || null,
    displayOrder: draft.displayOrder.trim() ? Number(draft.displayOrder) : null,
    options,
    helpText: draft.helpText.trim() || null,
  };
}

export function AdminRdFieldsSection() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canCreate = can(P.REFERENCE_CREATE);
  const canUpdate = can(P.REFERENCE_UPDATE);
  const canDelete = can(P.REFERENCE_DELETE);

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['admin-issue-fields'],
    queryFn: fetchAdminIssueFields,
  });

  const [editing, setEditing] = useState<IssueFieldDefinition | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-issue-fields'] });
    void qc.invalidateQueries({ queryKey: ['issue-fields-active'] });
  };

  const createMut = useMutation({
    mutationFn: createAdminIssueField,
    onSuccess: () => {
      setCreating(false);
      setDraft(emptyDraft());
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof toPayload> }) =>
      updateAdminIssueField(id, payload),
    onSuccess: () => {
      setEditing(null);
      setError(null);
      invalidate();
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAdminIssueField,
    onSuccess: () => invalidate(),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setDraft(emptyDraft());
    setError(null);
  };

  const openEdit = (field: IssueFieldDefinition) => {
    setCreating(false);
    setEditing(field);
    setDraft(draftFromField(field));
    setError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = toPayload(draft);
    if (!payload.label) {
      setError('Name is required');
      return;
    }
    if (creating) {
      createMut.mutate(payload);
    } else if (editing) {
      updateMut.mutate({ id: editing.id, payload });
    }
  };

  const showForm = creating || !!editing;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">RD fields</h2>
          <p className="mt-1 text-sm text-text2">
            Fixed fields stay on every RD (Change Request Name, Description, Priority, Current Stage,
            Capitalization). Manage additional global fields here — they appear on create/edit forms.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={16} />
            Add field
          </button>
        )}
      </div>

      {error && !showForm && (
        <p className="mt-3 text-sm text-danger">{error}</p>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 space-y-3 rounded-xl border border-border bg-bg3/40 p-4"
        >
          <h3 className="text-sm font-semibold">{creating ? 'New field' : `Edit — ${editing?.label}`}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="text-text2">Name</span>
              <input
                required
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text2">Key (optional on create)</span>
              <input
                value={draft.fieldKey}
                disabled={!!editing?.systemField}
                onChange={(e) => setDraft((d) => ({ ...d, fieldKey: e.target.value }))}
                className={inputClass}
                placeholder="auto from name"
              />
            </label>
            <label className="block text-sm">
              <span className="text-text2">Data type</span>
              <select
                value={draft.dataType}
                disabled={!!editing?.systemField}
                onChange={(e) => setDraft((d) => ({ ...d, dataType: e.target.value }))}
                className={inputClass}
              >
                {DATA_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-text2">Max length (text)</span>
              <input
                type="number"
                min={1}
                value={draft.maxLength}
                onChange={(e) => setDraft((d) => ({ ...d, maxLength: e.target.value }))}
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="text-text2">Section</span>
              <select
                value={draft.sectionCode}
                onChange={(e) => setDraft((d) => ({ ...d, sectionCode: e.target.value }))}
                className={inputClass}
              >
                {Object.entries(ISSUE_FIELD_SECTION_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-text2">Display order</span>
              <input
                type="number"
                value={draft.displayOrder}
                onChange={(e) => setDraft((d) => ({ ...d, displayOrder: e.target.value }))}
                className={inputClass}
              />
            </label>
            {draft.dataType === 'DROPDOWN' && (
              <label className="block text-sm sm:col-span-2">
                <span className="text-text2">Options (comma-separated)</span>
                <input
                  required
                  value={draft.optionsText}
                  onChange={(e) => setDraft((d) => ({ ...d, optionsText: e.target.value }))}
                  className={inputClass}
                  placeholder="Yes, No"
                />
              </label>
            )}
            <label className="block text-sm sm:col-span-2">
              <span className="text-text2">Help text</span>
              <input
                value={draft.helpText}
                onChange={(e) => setDraft((d) => ({ ...d, helpText: e.target.value }))}
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.required}
                onChange={(e) => setDraft((d) => ({ ...d, required: e.target.checked }))}
              />
              Mandatory
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
              />
              Active
            </label>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMut.isPending || updateMut.isPending}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={{ color: 'var(--accent-fg)' }}
            >
              {creating ? 'Create' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setEditing(null);
                setError(null);
              }}
              className="rounded-lg border border-border px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="mt-4 text-sm text-text2">Loading…</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-border bg-bg3/60 text-text2">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Section</th>
                <th className="px-3 py-2 font-medium">Required</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b border-border/70">
                  <td className="px-3 py-2">
                    {field.label}
                    {field.systemField && (
                      <span className="ml-2 text-xs text-text2">system</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{field.fieldKey}</td>
                  <td className="px-3 py-2">{field.dataType}</td>
                  <td className="px-3 py-2">
                    {ISSUE_FIELD_SECTION_LABELS[field.sectionCode ?? ''] ?? field.sectionCode ?? '—'}
                  </td>
                  <td className="px-3 py-2">{field.required ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{field.active ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{field.displayOrder}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex gap-1">
                      {canUpdate && (
                        <button
                          type="button"
                          onClick={() => openEdit(field)}
                          className="rounded p-1 hover:bg-bg3"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {canDelete && !field.systemField && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete field "${field.label}"?`)) {
                              deleteMut.mutate(field.id);
                            }
                          }}
                          className="rounded p-1 text-danger hover:bg-danger/10"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {fields.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-text2">
                    No RD fields yet. Add one or restart the API so seeded fields load.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
