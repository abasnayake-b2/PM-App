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
  rdFieldInputErrorClass,
  rdFieldLabelClass,
  rdFieldTextareaClass,
} from '@/components/IssueCustomFields';
import { IssueRisksSection } from '@/components/IssueRisksSection';
import { IssueQuarterlyCompletionSection } from '@/components/IssueQuarterlyCompletionSection';
import { IssueNotesSection } from '@/components/IssueNotesSection';
import {
  firstCustomFieldErrorMessage,
  firstFieldErrorKey,
  sanitizePercentageCompletionInput,
  scrollToIssueField,
  validateIssueCustomFields,
} from '@/utils/issueFieldValidation';

interface IssueEditFormProps {
  issue: Issue;
  priorities: Priority[];
  statuses: IssueStatus[];
  loading?: boolean;
  submitError?: unknown;
  onCancel: () => void;
  onSave: (payload: UpdateIssuePayload, nextStatusId: string) => void;
}

function normalizeCustomFields(raw: Record<string, string> | null | undefined): Record<string, string> {
  const next = { ...(raw ?? {}) };
  if (next.percentage_completion != null && next.percentage_completion !== '') {
    next.percentage_completion = sanitizePercentageCompletionInput(next.percentage_completion);
  }
  return next;
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
  const [jiraId, setJiraId] = useState(issue.jiraId ?? '');
  const [bmsId, setBmsId] = useState(issue.bmsId ?? '');
  const [description, setDescription] = useState(issue.description ?? '');
  const [priorityId, setPriorityId] = useState(issue.priorityId);
  const [statusId, setStatusId] = useState(issue.statusId);
  const [capitalizable, setCapitalizable] = useState(
    issue.capitalizable == null ? '' : issue.capitalizable ? 'true' : 'false',
  );
  const [customFields, setCustomFields] = useState<Record<string, string>>(
    () => normalizeCustomFields(issue.customFields),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(issue.title);
    setJiraId(issue.jiraId ?? '');
    setBmsId(issue.bmsId ?? '');
    setDescription(issue.description ?? '');
    setPriorityId(issue.priorityId);
    setStatusId(issue.statusId);
    setCapitalizable(issue.capitalizable == null ? '' : issue.capitalizable ? 'true' : 'false');
    setCustomFields(normalizeCustomFields(issue.customFields));
    setFieldErrors({});
    setLocalError(null);
  }, [issue]);

  const errorMessage = (() => {
    if (localError) return localError;
    if (!submitError) return null;
    if (isAxiosError(submitError)) {
      const data = submitError.response?.data as { detail?: string; message?: string } | undefined;
      return data?.detail ?? data?.message ?? 'Failed to save issue.';
    }
    if (submitError instanceof Error) return submitError.message;
    return 'Failed to save issue.';
  })();

  const handleCustomChange = (key: string, value: string) => {
    setCustomFields((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLocalError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const errors: Record<string, string> = {};
    if (!trimmedTitle) {
      errors.title = 'Change Request Name is required';
    }
    if (!priorityId) {
      errors.priorityId = 'Priority is required';
    }
    if (!statusId) {
      errors.statusId = 'Current Stage is required';
    }

    const normalizedFields = normalizeCustomFields(customFields);
    setCustomFields(normalizedFields);
    Object.assign(errors, validateIssueCustomFields(normalizedFields, customFieldDefs));
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLocalError(firstCustomFieldErrorMessage(errors));
      const firstKey = firstFieldErrorKey(errors, [
        'title',
        'priorityId',
        'statusId',
        ...customFieldDefs.map((f) => f.fieldKey),
      ]);
      if (firstKey) {
        requestAnimationFrame(() => scrollToIssueField(firstKey));
      }
      return;
    }
    setLocalError(null);

    const payload: UpdateIssuePayload = {
      title: trimmedTitle,
      description,
      priorityId,
      customFields: normalizedFields,
    };

    const trimmedJira = jiraId.trim();
    if (trimmedJira) {
      payload.jiraId = trimmedJira;
    } else if (issue.jiraId) {
      payload.clearJiraId = true;
    }

    const trimmedBms = bmsId.trim();
    if (trimmedBms) {
      payload.bmsId = trimmedBms;
    } else if (issue.bmsId) {
      payload.clearBmsId = true;
    }

    if (capitalizable === 'true') {
      payload.capitalizable = true;
    } else if (capitalizable === 'false') {
      payload.capitalizable = false;
    }

    onSave(payload, statusId);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
      <div className="overflow-hidden rounded-lg border border-accent/30 bg-bg2 shadow-sm">
        <div className="border-b border-accent/20 bg-gradient-to-r from-[color:var(--accent-muted)] to-transparent px-2.5 py-1.5">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-accent">
            Editing RD
          </h3>
        </div>
        <div className="space-y-2.5 p-2.5">
          <div className="grid grid-cols-2 gap-x-1 gap-y-1.5">
            <label className="block min-w-0">
              <span className={rdFieldLabelClass}>
                JIRA ID
              </span>
              <input
                type="text"
                maxLength={80}
                value={jiraId}
                onChange={(e) => setJiraId(e.target.value)}
                className={rdFieldInputClass}
                placeholder="e.g. PROJ-123"
              />
            </label>
            <label className="block min-w-0">
              <span className={rdFieldLabelClass}>
                BMS ID
              </span>
              <input
                type="text"
                maxLength={80}
                value={bmsId}
                onChange={(e) => setBmsId(e.target.value)}
                className={rdFieldInputClass}
              />
            </label>
          </div>

          <label className="block min-w-0" data-issue-field="title">
            <span className={rdFieldLabelClass}>
              Change Request Name <span className="text-danger">*</span>
            </span>
            <input
              type="text"
              required
              maxLength={255}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setFieldErrors((prev) => {
                  if (!prev.title) return prev;
                  const next = { ...prev };
                  delete next.title;
                  return next;
                });
                setLocalError(null);
              }}
              className={fieldErrors.title ? rdFieldInputErrorClass : rdFieldInputClass}
              aria-invalid={!!fieldErrors.title}
            />
            {fieldErrors.title ? (
              <span className="mt-0.5 block text-[9px] leading-snug text-danger">
                {fieldErrors.title}
              </span>
            ) : null}
          </label>

          <label className="block min-w-0">
            <span className={rdFieldLabelClass}>
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

          <div className="grid grid-cols-3 gap-x-1 gap-y-1.5 sm:grid-cols-6">
            <label className="min-w-0 block" data-issue-field="priorityId">
              <span className={rdFieldLabelClass}>
                Priority <span className="text-danger">*</span>
              </span>
              <select
                required
                value={priorityId}
                onChange={(e) => {
                  setPriorityId(e.target.value);
                  setFieldErrors((prev) => {
                    if (!prev.priorityId) return prev;
                    const next = { ...prev };
                    delete next.priorityId;
                    return next;
                  });
                  setLocalError(null);
                }}
                className={fieldErrors.priorityId ? rdFieldInputErrorClass : rdFieldInputClass}
                aria-invalid={!!fieldErrors.priorityId}
              >
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {fieldErrors.priorityId ? (
                <span className="mt-0.5 block text-[9px] leading-snug text-danger">
                  {fieldErrors.priorityId}
                </span>
              ) : null}
            </label>

            <label className="min-w-0 block" data-issue-field="statusId">
              <span className={rdFieldLabelClass}>
                Current Stage <span className="text-danger">*</span>
              </span>
              <select
                required
                value={statusId}
                onChange={(e) => {
                  setStatusId(e.target.value);
                  setFieldErrors((prev) => {
                    if (!prev.statusId) return prev;
                    const next = { ...prev };
                    delete next.statusId;
                    return next;
                  });
                  setLocalError(null);
                }}
                className={fieldErrors.statusId ? rdFieldInputErrorClass : rdFieldInputClass}
                aria-invalid={!!fieldErrors.statusId}
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {fieldErrors.statusId ? (
                <span className="mt-0.5 block text-[9px] leading-snug text-danger">
                  {fieldErrors.statusId}
                </span>
              ) : null}
            </label>

            <label className="min-w-0 block">
              <span className={rdFieldLabelClass}>
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
        onChange={handleCustomChange}
        fieldErrors={fieldErrors}
        compact
      />

      <IssueNotesSection issueId={issue.id} mode="edit" />

      <IssueQuarterlyCompletionSection issueId={issue.id} mode="edit" />

      <IssueRisksSection
        issueId={issue.id}
        mode="edit"
        customFields={customFieldDefs}
        customFieldValues={customFields}
        onCustomFieldChange={handleCustomChange}
        customFieldErrors={fieldErrors}
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
