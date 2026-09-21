import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { TaskPayload, TaskRecord } from '@/api/scopedTasks.api';
import {
  RdSectionCard,
  rdFieldInputClass,
  rdFieldLabelClass,
  rdFieldTextareaClass,
} from '@/components/IssueCustomFields';
import { formatProjectTaskDisplayKey, formatTaskDisplayKey } from '@/utils/issueUi';

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
  module: string;
};

const emptyDraft = (): Draft => ({
  description: '',
  module: '',
});

function draftFromTask(row: TaskRecord): Draft {
  return {
    description: row.description ?? '',
    module: row.module ?? '',
  };
}

function toCreatePayload(draft: Draft): TaskPayload | string {
  const description = draft.description.trim();
  if (!description) return 'Task description is required';
  return {
    description,
    module: draft.module.trim() || undefined,
  };
}

function toUpdatePayload(draft: Draft, original: TaskRecord): TaskPayload | string {
  const description = draft.description.trim();
  if (!description) return 'Task description is required';
  const payload: TaskPayload = { description };
  if (draft.module.trim()) payload.module = draft.module.trim();
  else if (original.module) payload.clearModule = true;
  return payload;
}

function TaskForm({
  title,
  taskNumberLabel,
  draft,
  setDraft,
  loading,
  error,
  localError,
  onCancel,
  onSubmit,
}: {
  title: string;
  taskNumberLabel: string;
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
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'TEXTAREA') return;
        save(e);
      }}
    >
      <h5 className="text-[10px] font-semibold uppercase tracking-wide text-accent">{title}</h5>
      <div className="grid grid-cols-2 gap-x-1 gap-y-1.5 sm:grid-cols-6">
        <label className="min-w-0 block sm:col-span-3">
          <span className={rdFieldLabelClass}>Task number</span>
          <input type="text" value={taskNumberLabel} readOnly className={`${rdFieldInputClass} bg-bg3 text-text2`} />
        </label>
        <label className="min-w-0 block sm:col-span-3">
          <span className={rdFieldLabelClass}>Module</span>
          <input
            type="text"
            value={draft.module}
            onChange={(e) => setDraft({ ...draft, module: e.target.value })}
            className={rdFieldInputClass}
            maxLength={120}
          />
        </label>
        <label className="col-span-2 min-w-0 block sm:col-span-6">
          <span className={rdFieldLabelClass}>
            Task description <span className="text-danger">*</span>
          </span>
          <textarea
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={rdFieldTextareaClass}
            maxLength={4000}
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
          {loading ? 'Saving…' : 'Save task'}
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

function nextLocalNumber(rows: TaskRecord[]): number {
  return rows.reduce((max, row) => Math.max(max, row.taskNumber || 0), 0) + 1;
}

export function TasksSection({
  title,
  tasks,
  isLoading,
  canManage,
  createPending,
  updatePending,
  deletePending,
  createError,
  updateError,
  onResetCreate,
  onResetUpdate,
  onCreate,
  onUpdate,
  onDelete,
  localMode = false,
  keyPrefix,
  keyStyle = 'rd',
}: {
  title: string;
  tasks: TaskRecord[];
  isLoading?: boolean;
  canManage: boolean;
  createPending?: boolean;
  updatePending?: boolean;
  deletePending?: boolean;
  createError?: unknown;
  updateError?: unknown;
  onResetCreate?: () => void;
  onResetUpdate?: () => void;
  onCreate: (payload: TaskPayload, onSuccess: () => void, localRow?: TaskRecord) => void;
  onUpdate: (id: string, payload: TaskPayload, onSuccess: () => void) => void;
  onDelete: (id: string) => void;
  localMode?: boolean;
  /** RD key (ABIC-GBL-RD-1) or project key (ABIC-GBL) for auto task numbers. */
  keyPrefix?: string;
  /** RD tasks: {RD}-RT-{n}. Project tasks: {project}-PT-{n}. */
  keyStyle?: 'rd' | 'project';
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const row = tasks.find((t) => t.id === editingId);
    if (row) setDraft(draftFromTask(row));
  }, [editingId, tasks]);

  const startAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setAdding(true);
    setLocalError(null);
    onResetCreate?.();
  };

  const startEdit = (row: TaskRecord) => {
    setAdding(false);
    setEditingId(row.id);
    setDraft(draftFromTask(row));
    setLocalError(null);
    onResetUpdate?.();
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setLocalError(null);
    onResetCreate?.();
    onResetUpdate?.();
  };

  const editingRow = editingId ? tasks.find((t) => t.id === editingId) : undefined;
  const addNumber = nextLocalNumber(tasks);
  const formatKey = (n: number) =>
    keyStyle === 'project'
      ? formatProjectTaskDisplayKey(keyPrefix, n)
      : formatTaskDisplayKey(keyPrefix, n);
  const nextDisplayKey = formatKey(addNumber);
  /** Prefer {project}-PT-{n} / {RD}-RT-{n}; ignore legacy API keys like T1. */
  const visibleKey = (row: TaskRecord) => {
    if (keyPrefix?.trim() && row.taskNumber) return formatKey(row.taskNumber);
    const dk = row.displayKey?.trim();
    if (dk && !/^T\d+$/i.test(dk)) return dk;
    return formatKey(row.taskNumber);
  };

  return (
    <RdSectionCard title={title} sectionCode="TASKS" mode={canManage ? 'edit' : 'view'}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[10px] text-text2">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </p>
        {canManage && !adding && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={12} />
            Add Task
          </button>
        )}
      </div>

      {canManage && adding && (
        <TaskForm
          title="Add task"
          taskNumberLabel={`${nextDisplayKey} (auto)`}
          draft={draft}
          setDraft={(next) => {
            setDraft(next);
            setLocalError(null);
          }}
          loading={createPending}
          error={createError}
          localError={localError}
          onCancel={cancelForm}
          onSubmit={() => {
            const payload = toCreatePayload(draft);
            if (typeof payload === 'string') {
              setLocalError(payload);
              return;
            }
            setLocalError(null);
            if (localMode) {
              const number = addNumber;
              onCreate(
                payload,
                cancelForm,
                {
                  id: newLocalId(),
                  taskNumber: number,
                  displayKey: nextDisplayKey,
                  description: payload.description,
                  module: payload.module ?? undefined,
                },
              );
              return;
            }
            onCreate(payload, cancelForm);
          }}
        />
      )}

      {canManage && editingRow && (
        <TaskForm
          title="Edit task"
          taskNumberLabel={visibleKey(editingRow)}
          draft={draft}
          setDraft={(next) => {
            setDraft(next);
            setLocalError(null);
          }}
          loading={updatePending}
          error={updateError}
          localError={localError}
          onCancel={cancelForm}
          onSubmit={() => {
            const payload = toUpdatePayload(draft, editingRow);
            if (typeof payload === 'string') {
              setLocalError(payload);
              return;
            }
            setLocalError(null);
            onUpdate(editingRow.id, payload, cancelForm);
          }}
        />
      )}

      {isLoading && <p className="text-xs text-text2">Loading tasks…</p>}

      {!isLoading && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-border bg-bg3/80 text-text2">
                <th className="px-1.5 py-1 font-semibold">Task number</th>
                <th className="px-1.5 py-1 font-semibold">Task description</th>
                <th className="px-1.5 py-1 font-semibold">Module</th>
                {canManage && <th className="px-1.5 py-1 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 4 : 3}
                    className="px-1.5 py-2 text-center text-text2"
                  >
                    No tasks yet.{canManage ? ' Click Add Task to create one.' : ''}
                  </td>
                </tr>
              ) : (
                tasks.map((row) =>
                  editingId === row.id ? null : (
                    <tr key={row.id} className="border-b border-border/80 align-top last:border-0">
                      <td className="whitespace-nowrap px-1.5 py-1 font-medium">
                        {visibleKey(row)}
                      </td>
                      <td className="max-w-[22rem] px-1.5 py-1">
                        <span className="whitespace-pre-wrap">{row.description?.trim() || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1">{row.module?.trim() || '—'}</td>
                      {canManage && (
                        <td className="whitespace-nowrap px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 hover:bg-amber-500/25"
                              title="Edit task"
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Delete this task? This cannot be undone from the list.')) {
                                  onDelete(row.id);
                                }
                              }}
                              disabled={deletePending}
                              className="inline-flex items-center gap-0.5 rounded border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-800 hover:bg-orange-500/25 disabled:opacity-50"
                              title="Delete task"
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
