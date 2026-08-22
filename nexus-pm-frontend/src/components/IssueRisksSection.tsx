import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import {
  RISK_IMPACT_OPTIONS,
  RISK_STATUS_OPTIONS,
  type IssueRisk,
  type IssueRiskPayload,
} from '@/api/issueRisks.api';
import {
  useCreateIssueRisk,
  useDeleteIssueRisk,
  useIssueRisks,
  useUpdateIssueRisk,
} from '@/hooks/useIssueRisks';
import { usePermissions } from '@/hooks/usePermissions';
import { formatMmDdYyyy } from '@/utils/dateFormat';
import { P } from '@/utils/permissions';
import {
  IssueCustomFieldsEditor,
  IssueCustomFieldsView,
  RdSectionCard,
  rdFieldInputClass,
  rdFieldLabelClass,
  rdFieldTextareaClass,
  riskSectionFields,
} from '@/components/IssueCustomFields';
import type { IssueFieldDefinition } from '@/api/issueFields.api';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail ?? data?.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

type Draft = {
  description: string;
  createdDate: string;
  owner: string;
  status: string;
  impact: string;
  closedDate: string;
  mitigation: string;
};

const emptyDraft = (): Draft => ({
  description: '',
  createdDate: '',
  owner: '',
  status: '',
  impact: '',
  closedDate: '',
  mitigation: '',
});

function draftFromRisk(risk: IssueRisk): Draft {
  return {
    description: risk.description ?? '',
    createdDate: risk.createdDate ?? '',
    owner: risk.owner ?? '',
    status: risk.status ?? '',
    impact: risk.impact ?? '',
    closedDate: risk.closedDate ?? '',
    mitigation: risk.mitigation ?? '',
  };
}

function toCreatePayload(draft: Draft): IssueRiskPayload {
  return {
    description: draft.description.trim() || undefined,
    createdDate: draft.createdDate || undefined,
    owner: draft.owner.trim() || undefined,
    status: draft.status || undefined,
    impact: draft.impact || undefined,
    closedDate: draft.closedDate || undefined,
    mitigation: draft.mitigation.trim() || undefined,
  };
}

function toUpdatePayload(draft: Draft, original: IssueRisk): IssueRiskPayload {
  const payload: IssueRiskPayload = {
    description: draft.description.trim(),
  };

  if (draft.createdDate) payload.createdDate = draft.createdDate;
  else if (original.createdDate) payload.clearCreatedDate = true;

  if (draft.owner.trim()) payload.owner = draft.owner.trim();
  else if (original.owner) payload.clearOwner = true;

  if (draft.status) payload.status = draft.status;
  else if (original.status) payload.clearStatus = true;

  if (draft.impact) payload.impact = draft.impact;
  else if (original.impact) payload.clearImpact = true;

  if (draft.closedDate) payload.closedDate = draft.closedDate;
  else if (original.closedDate) payload.clearClosedDate = true;

  if (draft.mitigation.trim()) payload.mitigation = draft.mitigation.trim();
  else if (original.mitigation) payload.clearMitigation = true;

  return payload;
}

function RiskForm({
  title,
  draft,
  setDraft,
  loading,
  error,
  onCancel,
  onSubmit,
}: {
  title: string;
  draft: Draft;
  setDraft: (next: Draft) => void;
  loading?: boolean;
  error?: unknown;
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
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'TEXTAREA') return;
        save(e);
      }}
    >
      <h5 className="text-[10px] font-semibold uppercase tracking-wide text-accent">{title}</h5>
      <div className="grid grid-cols-2 gap-x-1 gap-y-1.5 sm:grid-cols-6 lg:grid-cols-7">
        <label className="col-span-2 min-w-0 block sm:col-span-6 lg:col-span-7">
          <span className={rdFieldLabelClass}>
            Risk Description
          </span>
          <textarea
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={rdFieldTextareaClass}
            maxLength={4000}
          />
        </label>
        <label className="col-span-2 min-w-0 block sm:col-span-6 lg:col-span-7">
          <span className={rdFieldLabelClass}>
            Risk Mitigation
          </span>
          <textarea
            rows={2}
            value={draft.mitigation}
            onChange={(e) => setDraft({ ...draft, mitigation: e.target.value })}
            className={rdFieldTextareaClass}
            maxLength={4000}
          />
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>
            Created Date
          </span>
          <input
            type="date"
            value={draft.createdDate}
            onChange={(e) => setDraft({ ...draft, createdDate: e.target.value })}
            className={rdFieldInputClass}
          />
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>Owner</span>
          <input
            type="text"
            value={draft.owner}
            onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
            className={rdFieldInputClass}
            maxLength={120}
          />
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>Status</span>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
            className={rdFieldInputClass}
          >
            <option value="">Not set</option>
            {RISK_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>Impact</span>
          <select
            value={draft.impact}
            onChange={(e) => setDraft({ ...draft, impact: e.target.value })}
            className={rdFieldInputClass}
          >
            <option value="">Not set</option>
            {RISK_IMPACT_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>
            Closed Date
          </span>
          <input
            type="date"
            value={draft.closedDate}
            onChange={(e) => setDraft({ ...draft, closedDate: e.target.value })}
            className={rdFieldInputClass}
          />
        </label>
      </div>
      {error != null && (
        <p className="rounded border border-danger/30 bg-danger/10 px-2 py-1 text-[11px] text-danger">
          {apiErrorMessage(error)}
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
          {loading ? 'Saving…' : 'Save risk'}
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

function newLocalId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function IssueRisksSection({
  issueId,
  mode = 'view',
  localRows,
  onLocalRowsChange,
  customFields,
  customFieldValues,
  onCustomFieldChange,
  customFieldErrors,
}: {
  issueId?: string;
  /** 'edit' forces manage controls; 'view' still allows manage when user has ISSUES_UPDATE. */
  mode?: 'view' | 'edit';
  /** When set (create form, no issue yet), rows are kept in parent state until the RD is saved. */
  localRows?: IssueRisk[];
  onLocalRowsChange?: (rows: IssueRisk[]) => void;
  customFields?: IssueFieldDefinition[];
  customFieldValues?: Record<string, string> | null;
  onCustomFieldChange?: (fieldKey: string, value: string) => void;
  customFieldErrors?: Record<string, string>;
}) {
  const { can } = usePermissions();
  const localMode = !issueId;
  const canManage = localMode || can(P.ISSUES_UPDATE);
  const { data: remoteRisks = [], isLoading: remoteLoading } = useIssueRisks(issueId);
  const createRisk = useCreateIssueRisk(issueId ?? '');
  const updateRisk = useUpdateIssueRisk(issueId ?? '');
  const deleteRisk = useDeleteIssueRisk(issueId ?? '');
  const risks = localMode ? (localRows ?? []) : remoteRisks;
  const isLoading = localMode ? false : remoteLoading;
  const riskFields = riskSectionFields(customFields ?? []);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  useEffect(() => {
    if (!editingId) return;
    const risk = risks.find((r) => r.id === editingId);
    if (risk) setDraft(draftFromRisk(risk));
  }, [editingId, risks]);

  const startAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setAdding(true);
    createRisk.reset();
  };

  const startEdit = (risk: IssueRisk) => {
    setAdding(false);
    setEditingId(risk.id);
    setDraft(draftFromRisk(risk));
    updateRisk.reset();
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft());
    createRisk.reset();
    updateRisk.reset();
  };

  const editingRisk = editingId ? risks.find((r) => r.id === editingId) : undefined;

  return (
    <RdSectionCard title="Risk" sectionCode="RISK" mode={mode === 'edit' ? 'edit' : 'view'}>
      {riskFields.length > 0 && mode === 'edit' && onCustomFieldChange ? (
        <div className="mb-2">
          <IssueCustomFieldsEditor
            fields={riskFields}
            values={customFieldValues ?? {}}
            onChange={onCustomFieldChange}
            fieldErrors={customFieldErrors}
            compact
            includeRisk
            wrapSections={false}
          />
        </div>
      ) : null}
      {riskFields.length > 0 && mode !== 'edit' ? (
        <div className="mb-2">
          <IssueCustomFieldsView
            fields={riskFields}
            values={customFieldValues}
            includeRisk
            wrapSections={false}
          />
        </div>
      ) : null}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[10px] text-text2">
          {risks.length} risk{risks.length !== 1 ? 's' : ''}
        </p>
        {canManage && !adding && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={12} />
            Add Risk
          </button>
        )}
      </div>

      {canManage && adding && (
        <RiskForm
          title="Add risk"
          draft={draft}
          setDraft={setDraft}
          loading={createRisk.isPending}
          error={createRisk.error}
          onCancel={cancelForm}
          onSubmit={() => {
            const payload = toCreatePayload(draft);
            if (localMode) {
              const nextNumber = risks.length + 1;
              onLocalRowsChange?.([
                ...risks,
                {
                  id: newLocalId(),
                  issueId: '',
                  riskNumber: nextNumber,
                  displayKey: `R${nextNumber}`,
                  description: payload.description,
                  createdDate: payload.createdDate ?? undefined,
                  owner: payload.owner ?? undefined,
                  status: payload.status ?? undefined,
                  impact: payload.impact ?? undefined,
                  closedDate: payload.closedDate ?? undefined,
                  mitigation: payload.mitigation,
                },
              ]);
              cancelForm();
              return;
            }
            createRisk.mutate(payload, {
              onSuccess: cancelForm,
            });
          }}
        />
      )}

      {canManage && editingRisk && (
        <RiskForm
          title={`Edit ${editingRisk.displayKey}`}
          draft={draft}
          setDraft={setDraft}
          loading={updateRisk.isPending}
          error={updateRisk.error}
          onCancel={cancelForm}
          onSubmit={() => {
            const payload = toUpdatePayload(draft, editingRisk);
            if (localMode) {
              onLocalRowsChange?.(
                risks.map((risk) =>
                  risk.id === editingRisk.id
                    ? {
                        ...risk,
                        description: payload.description ?? risk.description,
                        createdDate: payload.clearCreatedDate
                          ? undefined
                          : (payload.createdDate ?? risk.createdDate),
                        owner: payload.clearOwner ? undefined : (payload.owner ?? risk.owner),
                        status: payload.clearStatus ? undefined : (payload.status ?? risk.status),
                        impact: payload.clearImpact ? undefined : (payload.impact ?? risk.impact),
                        closedDate: payload.clearClosedDate
                          ? undefined
                          : (payload.closedDate ?? risk.closedDate),
                        mitigation: payload.clearMitigation
                          ? undefined
                          : (payload.mitigation ?? risk.mitigation),
                      }
                    : risk,
                ),
              );
              cancelForm();
              return;
            }
            updateRisk.mutate({ id: editingRisk.id, payload }, { onSuccess: cancelForm });
          }}
        />
      )}

      {isLoading && <p className="text-xs text-text2">Loading risks…</p>}

      {!isLoading && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[48rem] border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-border bg-bg3/80 text-text2">
                <th className="px-1.5 py-1 font-semibold">Risk ID</th>
                <th className="px-1.5 py-1 font-semibold">Description</th>
                <th className="px-1.5 py-1 font-semibold">Created</th>
                <th className="px-1.5 py-1 font-semibold">Owner</th>
                <th className="px-1.5 py-1 font-semibold">Status</th>
                <th className="px-1.5 py-1 font-semibold">Impact</th>
                <th className="px-1.5 py-1 font-semibold">Closed</th>
                <th className="px-1.5 py-1 font-semibold">Mitigation</th>
                {canManage && <th className="px-1.5 py-1 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {risks.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 9 : 8}
                    className="px-1.5 py-2 text-center text-text2"
                  >
                    No risks yet.{canManage ? ' Click Add Risk to create one.' : ''}
                  </td>
                </tr>
              ) : (
                risks.map((risk) =>
                  editingId === risk.id ? null : (
                    <tr key={risk.id} className="border-b border-border/80 align-top last:border-0">
                      <td className="whitespace-nowrap px-1.5 py-1 font-mono font-medium">
                        {risk.displayKey}
                      </td>
                      <td className="max-w-[12rem] px-1.5 py-1">
                        <span className="line-clamp-2 whitespace-pre-wrap">
                          {risk.description?.trim() || '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1 text-text2">
                        {formatMmDdYyyy(risk.createdDate)}
                      </td>
                      <td className="px-1.5 py-1">{risk.owner?.trim() || '—'}</td>
                      <td className="px-1.5 py-1">{risk.status || '—'}</td>
                      <td className="px-1.5 py-1">{risk.impact || '—'}</td>
                      <td className="whitespace-nowrap px-1.5 py-1 text-text2">
                        {formatMmDdYyyy(risk.closedDate)}
                      </td>
                      <td className="max-w-[10rem] px-1.5 py-1">
                        <span className="line-clamp-2 whitespace-pre-wrap">
                          {risk.mitigation?.trim() || '—'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="whitespace-nowrap px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(risk)}
                              className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 hover:bg-amber-500/25"
                              title="Edit risk"
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete risk ${risk.displayKey}? This cannot be undone from the list.`,
                                  )
                                ) {
                                  if (localMode) {
                                    onLocalRowsChange?.(risks.filter((row) => row.id !== risk.id));
                                  } else {
                                    deleteRisk.mutate(risk.id);
                                  }
                                }
                              }}
                              disabled={deleteRisk.isPending}
                              className="inline-flex items-center gap-0.5 rounded border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-800 hover:bg-orange-500/25 disabled:opacity-50"
                              title="Delete risk"
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
