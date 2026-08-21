import { useEffect, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { isAxiosError } from 'axios';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { IssueNote, IssueNotePayload } from '@/api/issueNotes.api';
import {
  useCreateIssueNote,
  useDeleteIssueNote,
  useIssueNotes,
  useUpdateIssueNote,
} from '@/hooks/useIssueNotes';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuthStore } from '@/store/useAuthStore';
import { P } from '@/utils/permissions';
import {
  RdSectionCard,
  rdFieldInputClass,
  rdFieldLabelClass,
  rdFieldTextareaClass,
} from '@/components/IssueCustomFields';

function apiErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const data = error.response?.data as { detail?: string; message?: string } | undefined;
    return data?.detail ?? data?.message ?? 'Request failed';
  }
  if (error instanceof Error) return error.message;
  return 'Request failed';
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Draft = {
  date: string;
  note: string;
};

const emptyDraft = (): Draft => ({
  date: todayIso(),
  note: '',
});

function draftFromNote(row: IssueNote): Draft {
  return {
    date: row.date ?? todayIso(),
    note: row.note ?? '',
  };
}

function toPayload(draft: Draft): IssueNotePayload | string {
  const note = draft.note.trim();
  if (!note) return 'Note is required';
  if (!draft.date) return 'Date is required';
  return { date: draft.date, note };
}

function NoteForm({
  title,
  draft,
  setDraft,
  owner,
  loading,
  error,
  localError,
  onCancel,
  onSubmit,
}: {
  title: string;
  draft: Draft;
  setDraft: (next: Draft) => void;
  owner: string;
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
      <div className="grid grid-cols-2 gap-x-1 gap-y-1.5 sm:grid-cols-6 lg:grid-cols-7">
        <label className="min-w-0 block">
          <span className={rdFieldLabelClass}>
            Date <span className="text-danger">*</span>
          </span>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className={rdFieldInputClass}
          />
        </label>
        <label className="min-w-0 block sm:col-span-2">
          <span className={rdFieldLabelClass}>Owner</span>
          <input type="text" value={owner} readOnly className={`${rdFieldInputClass} bg-bg3 text-text2`} />
        </label>
        <label className="col-span-2 min-w-0 block sm:col-span-6 lg:col-span-7">
          <span className={rdFieldLabelClass}>
            Note <span className="text-danger">*</span>
          </span>
          <textarea
            rows={2}
            value={draft.note}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
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
          {loading ? 'Saving…' : 'Save note'}
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

export function IssueNotesSection({
  issueId,
  mode = 'view',
}: {
  issueId: string;
  mode?: 'view' | 'edit';
}) {
  const { can } = usePermissions();
  const canManage = can(P.ISSUES_UPDATE);
  const loggedInName = useAuthStore((s) => s.user?.name?.trim() || '');
  const { data: notes = [], isLoading } = useIssueNotes(issueId);
  const createNote = useCreateIssueNote(issueId);
  const updateNote = useUpdateIssueNote(issueId);
  const deleteNote = useDeleteIssueNote(issueId);

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId) return;
    const row = notes.find((n) => n.id === editingId);
    if (row) setDraft(draftFromNote(row));
  }, [editingId, notes]);

  const startAdd = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setAdding(true);
    setLocalError(null);
    createNote.reset();
  };

  const startEdit = (row: IssueNote) => {
    setAdding(false);
    setEditingId(row.id);
    setDraft(draftFromNote(row));
    setLocalError(null);
    updateNote.reset();
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyDraft());
    setLocalError(null);
    createNote.reset();
    updateNote.reset();
  };

  const submitDraft = (onValid: (payload: IssueNotePayload) => void) => {
    const payload = toPayload(draft);
    if (typeof payload === 'string') {
      setLocalError(payload);
      return;
    }
    setLocalError(null);
    onValid(payload);
  };

  const editingRow = editingId ? notes.find((n) => n.id === editingId) : undefined;
  const formOwner = editingRow?.owner || loggedInName;

  return (
    <RdSectionCard title="Notes" sectionCode="OTHER" mode={mode === 'edit' ? 'edit' : 'view'}>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[10px] text-text2">
          {notes.length} note{notes.length !== 1 ? 's' : ''}
        </p>
        {canManage && !adding && !editingId && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 rounded bg-accent px-2 py-0.5 text-[11px] font-medium"
            style={{ color: 'var(--accent-fg)' }}
          >
            <Plus size={12} />
            Add Note
          </button>
        )}
      </div>

      {canManage && adding && (
        <NoteForm
          title="Add note"
          draft={draft}
          setDraft={(next) => {
            setDraft(next);
            setLocalError(null);
          }}
          owner={loggedInName}
          loading={createNote.isPending}
          error={createNote.error}
          localError={localError}
          onCancel={cancelForm}
          onSubmit={() =>
            submitDraft((payload) => {
              createNote.mutate(payload, { onSuccess: cancelForm });
            })
          }
        />
      )}

      {canManage && editingRow && (
        <NoteForm
          title="Edit note"
          draft={draft}
          setDraft={(next) => {
            setDraft(next);
            setLocalError(null);
          }}
          owner={formOwner}
          loading={updateNote.isPending}
          error={updateNote.error}
          localError={localError}
          onCancel={cancelForm}
          onSubmit={() =>
            submitDraft((payload) => {
              updateNote.mutate({ id: editingRow.id, payload }, { onSuccess: cancelForm });
            })
          }
        />
      )}

      {isLoading && <p className="text-xs text-text2">Loading notes…</p>}

      {!isLoading && (
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-left text-[10px]">
            <thead>
              <tr className="border-b border-border bg-bg3/80 text-text2">
                <th className="px-1.5 py-1 font-semibold">Date</th>
                <th className="px-1.5 py-1 font-semibold">Note</th>
                <th className="px-1.5 py-1 font-semibold">Owner</th>
                {canManage && <th className="px-1.5 py-1 font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {notes.length === 0 ? (
                <tr>
                  <td
                    colSpan={canManage ? 4 : 3}
                    className="px-1.5 py-2 text-center text-text2"
                  >
                    No notes yet.{canManage ? ' Click Add Note to create one.' : ''}
                  </td>
                </tr>
              ) : (
                notes.map((row) =>
                  editingId === row.id ? null : (
                    <tr key={row.id} className="border-b border-border/80 align-top last:border-0">
                      <td className="whitespace-nowrap px-1.5 py-1 text-text2">{row.date || '—'}</td>
                      <td className="max-w-[22rem] px-1.5 py-1">
                        <span className="whitespace-pre-wrap">{row.note?.trim() || '—'}</span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-1">{row.owner || '—'}</td>
                      {canManage && (
                        <td className="whitespace-nowrap px-1.5 py-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-medium text-amber-800 hover:bg-amber-500/25"
                              title="Edit note"
                            >
                              <Pencil size={10} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Delete this note? This cannot be undone from the list.')) {
                                  deleteNote.mutate(row.id);
                                }
                              }}
                              disabled={deleteNote.isPending}
                              className="inline-flex items-center gap-0.5 rounded border border-orange-500/40 bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-800 hover:bg-orange-500/25 disabled:opacity-50"
                              title="Delete note"
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
