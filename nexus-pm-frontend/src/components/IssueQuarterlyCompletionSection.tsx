import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  QUARTER_OPTIONS,
  quarterLabel,
  type IssueQuarterlyCompletion,
  type IssueQuarterlyCompletionPayload,
} from '@/api/issueQuarterlyCompletions.api';
import {
  useCreateIssueQuarterlyCompletion,
  useDeleteIssueQuarterlyCompletion,
  useIssueQuarterlyCompletions,
  useUpdateIssueQuarterlyCompletion,
} from '@/hooks/useIssueQuarterlyCompletions';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import {
  RdSectionCard,
  rdFieldInputClass,
  rdFieldInputErrorClass,
  rdFieldLabelClass,
} from '@/components/IssueCustomFields';
import { sanitizePercentageCompletionInput } from '@/utils/issueFieldValidation';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail ?? data?.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

type Draft = {
  year: string;
  quarter: string;
  percentage: string;
};

const emptyDraft = (): Draft => ({
  year: String(new Date().getFullYear()),
  quarter: '',
  percentage: '',
});

function draftFromRow(row: IssueQuarterlyCompletion): Draft {
  return {
    year: String(row.year ?? ''),
    quarter: String(row.quarter ?? ''),
    percentage: String(row.percentage ?? ''),
  };
}

function toPayload(draft: Draft): IssueQuarterlyCompletionPayload | string {
  const year = Number.parseInt(draft.year, 10);
  const quarter = Number.parseInt(draft.quarter, 10);
  const percentage = Number(draft.percentage);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return 'Year must be between 2000 and 2100';
  }
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) {
    return 'Quarter is required';
  }
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    return 'Completion % must be a number between 0 and 100';
  }
  return { year, quarter, percentage };
}

function formatPct(value: number | string | undefined): string {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n}%`;
}

function QuarterForm({
  title,
  draft,
  setDraft,
  loading,
  error,
  localError,
  onCancel,
  onSubmit,
}: {
  title: string;
  draft: Draft;
  setDraft: (next: Draft) => void;
  loading?: boolean;
  error?: unknown;
  localError?: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const save = (e?: MouseEvent | KeyboardEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    onSubmit();
  };

  return (
    <div
      className="mt-2 space-y-1.5 rounded border border-accent/30 bg-bg p-2"
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        save(e);
      }}
    >
      <h5 className="text-[10px] font-semibold uppercase tracking-wide text-accent">{title}</h5>
      <div className="grid grid-cols-3 gap-x-1 gap-y-1.5 sm:grid-cols-6 lg:grid-cols-7">
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>
            Year <span className="text-danger">*</span>
          </span>
          <input
            type="number"
            min={2000}
            max={2100}
            step={1}
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value.replace(/\D/g, '').slice(0, 4) })}
            className={rdFieldInputClass}
            placeholder="YYYY"
          />
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>
            Quarter <span className="text-danger">*</span>
          </span>
          <select
            value={draft.quarter}
            onChange={(e) => setDraft({ ...draft, quarter: e.target.value })}
            className={rdFieldInputClass}
          >
            <option value="">Select</option>
            {QUARTER_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {quarterLabel(q)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>
            Completion % <span className="text-danger">*</span>
          </span>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            inputMode="numeric"
            value={draft.percentage}
            onChange={(e) =>
              setDraft({ ...draft, percentage: sanitizePercentageCompletionInput(e.target.value) })
            }
            className={rdFieldInputClass}
            placeholder="0–100"
          />
        </label>
      </div>
      {(localError || error != null) && (
        <p className="rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] text-danger">
          {localError || apiErrorMessage(error)}
        </p>
      )}
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={loading}
          onClick={save}
          className="rounded bg-accent px-2.5 py-1 text-[11px] font-medium disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : 'Save quarter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded border border-border bg-bg3 px-2.5 py-1 text-[11px] disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function IssueQuarterlyCompletionSection({
  issueId,
  mode = 'view',
}: {
  issueId: string;
  mode?: 'view' | 'edit';
}) {
  const { can } = usePermissions();
  const canManage = can(P.ISSUES_UPDATE);
  const { data: rows = [], isLoading } = useIssueQuarterlyCompletions(issueId);
  const createRow = useCreateIssueQuarterlyCompletion(issueId);
  const updateRow = useUpdateIssueQuarterlyCompletion(issueId);
  const deleteRow = useDeleteIssueQuarterlyCompletion(issueId);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const row = rows.find((r) => r.id === editingId);
    if (row) setDraft(draftFromRow(row));
  }, [editingId, rows]);

  const startAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setAdding(true);
    setLocalError(null);
    createRow.reset();
  };

  const startEdit = (row: IssueQuarterlyCompletion) => {
    setAdding(false);
    setEditingId(row.id);
    setDraft(draftFromRow(row));
    setLocalError(null);
    updateRow.reset();
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setLocalError(null);
    createRow.reset();
    updateRow.reset();
  };

  const submitDraft = (onValid: (payload: IssueQuarterlyCompletionPayload) => void) => {
    const payload = toPayload(draft);
    if (typeof payload === 'string') {
      setLocalError(payload);
      return;
    }
    setLocalError(null);
    onValid(payload);
  };

  const editingRow = editingId ? rows.find((r) => r.id === editingId) : undefined;
  const totalPct = rows.reduce((sum, row) => sum + Number(row.percentage || 0), 0);

  return (
    <RdSectionCard
      title="Quarterly completion"
      sectionCode="QUARTERLY_COMPLETION"
      mode={mode === 'edit' ? 'edit' : 'view'}
    >
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[10px] text-text2">
          {rows.length} quarter{rows.length !== 1 ? 's' : ''}
          {rows.length > 0 ? ` · total ${Number.isInteger(totalPct) ? totalPct : totalPct.toFixed(1)}%` : ''}
        </p>
        {canManage && !adding && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={12} />
            Add Quarter
          </button>
        )}
      </div>

      {canManage && adding && (
        <QuarterForm
          title="Add quarter"
          draft={draft}
          setDraft={(next) => {
            setDraft(next);
            setLocalError(null);
          }}
          loading={createRow.isPending}
          error={createRow.error}
          localError={localError}
          onCancel={cancelForm}
          onSubmit={() =>
            submitDraft((payload) => {
              createRow.mutate(payload, { onSuccess: cancelForm });
            })
          }
        />
      )}

      {canManage && editingRow && (
        <QuarterForm
          title={`Edit ${editingRow.displayKey}`}
          draft={draft}
          setDraft={(next) => {
            setDraft(next);
            setLocalError(null);
          }}
          loading={updateRow.isPending}
          error={updateRow.error}
          localError={localError}
          onCancel={cancelForm}
          onSubmit={() =>
            submitDraft((payload) => {
              updateRow.mutate({ id: editingRow.id, payload }, { onSuccess: cancelForm });
            })
          }
        />
      )}

      {isLoading && <p className="text-xs text-text2">Loading quarterly completion…</p>}

      {!isLoading && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[20rem] border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-border bg-bg3/80 text-text2">
                <th className="px-1.5 py-1 font-semibold">Year</th>
                <th className="px-1.5 py-1 font-semibold">Quarter</th>
                <th className="px-1.5 py-1 font-semibold">Completion %</th>
                {canManage && <th className="px-1.5 py-1 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 4 : 3}
                    className="px-1.5 py-2 text-center text-text2"
                  >
                    No quarterly completion yet.
                    {canManage ? ' Click Add Quarter to create one.' : ''}
                  </td>
                </tr>
              ) : (
                rows.map((row) =>
                  editingId === row.id ? null : (
                    <tr key={row.id} className="border-b border-border/80 last:border-0">
                      <td className="whitespace-nowrap px-1.5 py-1 font-medium">{row.year}</td>
                      <td className="whitespace-nowrap px-1.5 py-1">{quarterLabel(row.quarter)}</td>
                      <td className="whitespace-nowrap px-1.5 py-1">{formatPct(row.percentage)}</td>
                      {canManage && (
                        <td className="whitespace-nowrap px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 hover:bg-amber-500/25"
                              title="Edit quarter"
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${row.displayKey}? This cannot be undone from the list.`,
                                  )
                                ) {
                                  deleteRow.mutate(row.id);
                                }
                              }}
                              disabled={deleteRow.isPending}
                              className="inline-flex items-center gap-0.5 rounded border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-800 hover:bg-orange-500/25 disabled:opacity-50"
                              title="Delete quarter"
                            >
                              <Trash2 size={10} />
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ),
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </RdSectionCard>
  );
}
