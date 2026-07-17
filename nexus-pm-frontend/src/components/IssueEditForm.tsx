import { FormEvent, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type { UpdateIssuePayload } from '@/hooks/useIssues';
import type { Issue } from '@/types';
import type { Priority, IssueStatus } from '@/api/lookup.api';
import { fetchActiveIssueFields } from '@/api/issueFields.api';
import {
  IssueCustomFieldsEditor,
  rdFieldInputClass,
  rdFieldTextareaClass,
} from '@/components/IssueCustomFields';

interface IssueEditFormProps {
  issue: Issue;
  priorities: Priority[];
  statuses: IssueStatus[];
  loading?: boolean;
  submitError?: unknown;
  onCancel: () => void;
  onSave: (payload: UpdateIssuePayload, nextStatusId: string) => void;
}

export function IssueEditForm({
  issue,
  priorities,
  statuses,
  loading,
  submitError,
  onCancel,
  onSave,
}: IssueEditFormProps) {
  const { data: customFieldDefs = [] } = useQuery({
    queryKey: ['issue-fields-active'],
    queryFn: fetchActiveIssueFields,
  });

  const [title, setTitle] = useState(issue.title);
  const [description, setDescription] = useState(issue.description ?? '');
  const [priorityId, setPriorityId] = useState(issue.priorityId);
  const [statusId, setStatusId] = useState(issue.statusId);
  const [capitalizable, setCapitalizable] = useState(
    issue.capitalizable == null ? '' : issue.capitalizable ? 'true' : 'false',
  );
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    () => ({ ...(issue.customFields ?? {}) }),
  );

  useEffect(() => {
    setTitle(issue.title);
    setDescription(issue.description ?? '');
    setPriorityId(issue.priorityId);
    setStatusId(issue.statusId);
    setCapitalizable(issue.capitalizable == null ? '' : issue.capitalizable ? 'true' : 'false');
    setCustomFields({ ...(issue.customFields ?? {}) });
  }, [issue]);

  const errorMessage = (() => {
    if (!submitError) return null;
    if (isAxiosError(submitError)) {
      const data = submitError.response?.data as { detail?: string; message?: string } | undefined;
      return data?.detail ?? data?.message ?? 'Failed to save issue.';
    }
    if (submitError instanceof Error) return submitError.message;
    return 'Failed to save issue.';
  })();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const payload: UpdateIssuePayload = {
      title: trimmedTitle,
      description,
      priorityId,
      customFields,
    };

    if (capitalizable === 'true') {
      payload.capitalizable = true;
    } else if (capitalizable === 'false') {
      payload.capitalizable = false;
    }

    onSave(payload, statusId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
      <div className="overflow-hidden rounded-lg border border-accent/30 bg-bg2 shadow-sm">
        <div className="border-b border-accent/20 bg-gradient-to-r from-[color:var(--accent-muted)] to-transparent px-2.5 py-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Editing RD
          </h3>
        </div>
        <div className="space-y-2.5 p-2.5">
          <label className="block min-w-0">
            <span className="block text-[11px] font-medium leading-tight text-text2">
              Change Request Name
            </span>
            <input
              type="text"
              required
              maxLength={255}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={rdFieldInputClass}
            />
          </label>

          <label className="block min-w-0">
            <span className="block text-[11px] font-medium leading-tight text-text2">
              Description
            </span>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={rdFieldTextareaClass}
              placeholder="Optional details…"
            />
          </label>

          <div className="grid grid-cols-2 gap-x-1.5 gap-y-2 sm:grid-cols-4">
            <label className="min-w-0 block">
              <span className="block text-[11px] font-medium leading-tight text-text2">Priority</span>
              <select
                required
                value={priorityId}
                onChange={(e) => setPriorityId(e.target.value)}
                className={rdFieldInputClass}
              >
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 block">
              <span className="block text-[11px] font-medium leading-tight text-text2">
                Current Stage
              </span>
              <select
                required
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className={rdFieldInputClass}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="min-w-0 block">
              <span className="block text-[11px] font-medium leading-tight text-text2">
                Capitalization
              </span>
              <select
                value={capitalizable}
                onChange={(e) => setCapitalizable(e.target.value)}
                className={rdFieldInputClass}
              >
                <option value="">Not set</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <IssueCustomFieldsEditor
        fields={customFieldDefs}
        values={customFields}
        onChange={(key, value) => setCustomFields((prev) => ({ ...prev, [key]: value }))}
        compact
      />

      {errorMessage && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs text-danger">
          {errorMessage}
        </p>
      )}

      <div className="sticky bottom-0 z-[1] -mx-0.5 flex gap-2 border-t border-border bg-bg2/95 px-0.5 py-2 backdrop-blur-sm">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium shadow-sm transition hover:opacity-95 disabled:opacity-50"
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="rounded-md border border-border bg-bg3 px-3 py-1.5 text-xs hover:bg-bg disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
