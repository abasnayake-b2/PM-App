import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CreateIssuePayload } from '@/hooks/useIssues';
import type { Priority, IssueType } from '@/api/lookup.api';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { filterIssueTypesForParent } from '@/utils/issueHierarchy';
import { fetchActiveIssueFields } from '@/api/issueFields.api';
import {
  IssueCustomFieldsEditor,
  rdFieldInputClass,
  rdFieldTextareaClass,
} from '@/components/IssueCustomFields';
import {
  firstCustomFieldErrorMessage,
  validateIssueCustomFields,
} from '@/utils/issueFieldValidation';

export interface IssueFormOption {
  id: string;
  label: string;
}

export interface IssueFormParent {
  id: string;
  title: string;
  workflowCode: string;
  projectId: string;
}

interface IssueFormProps {
  projects: IssueFormOption[];
  priorities: Priority[];
  issueTypes: IssueType[];
  initialProjectId?: string;
  /** When true, project is fixed (no dropdown) — for project-scoped create panels. */
  lockProject?: boolean;
  parentIssue?: IssueFormParent;
  initialChildWorkflowCode?: string;
  loading?: boolean;
  /** `panel` drops the card chrome for use inside a slide-over. */
  variant?: 'page' | 'panel';
  onCancel: () => void;
  onSubmit: (payload: CreateIssuePayload) => void;
}

const pageInputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (value == null || value === '') return undefined;
  return value === 'true';
}

export function IssueForm({
  projects,
  priorities,
  issueTypes,
  initialProjectId,
  lockProject = false,
  parentIssue,
  initialChildWorkflowCode,
  loading,
  variant = 'page',
  onCancel,
  onSubmit,
}: IssueFormProps) {
  const { data: customFieldDefs = [] } = useQuery({
    queryKey: ['issue-fields-active'],
    queryFn: fetchActiveIssueFields,
  });

  const availableIssueTypes = useMemo(
    () => filterIssueTypesForParent(issueTypes, parentIssue?.workflowCode),
    [issueTypes, parentIssue?.workflowCode],
  );

  const defaultTypeId = useMemo(() => {
    if (!initialChildWorkflowCode) return '';
    return (
      availableIssueTypes.find(
        (type) => type.workflowCode.toUpperCase() === initialChildWorkflowCode.toUpperCase(),
      )?.id ?? ''
    );
  }, [availableIssueTypes, initialChildWorkflowCode]);

  const [projectId, setProjectId] = useState(parentIssue?.projectId ?? initialProjectId ?? '');
  const [issueTypeId, setIssueTypeId] = useState(defaultTypeId);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const selectedIssueType = availableIssueTypes.find((type) => type.id === issueTypeId);

  useEffect(() => {
    if (parentIssue?.projectId) {
      setProjectId(parentIssue.projectId);
    }
  }, [parentIssue?.projectId]);

  useEffect(() => {
    if (defaultTypeId) {
      setIssueTypeId(defaultTypeId);
    }
  }, [defaultTypeId]);

  useEffect(() => {
    if (issueTypeId && !availableIssueTypes.some((type) => type.id === issueTypeId)) {
      setIssueTypeId('');
    }
  }, [availableIssueTypes, issueTypeId]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const errors = validateIssueCustomFields(customFields);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLocalError(firstCustomFieldErrorMessage(errors));
      return;
    }
    setLocalError(null);

    const fd = new FormData(e.currentTarget);
    const payload: CreateIssuePayload = {
      projectId: projectId || (fd.get('projectId') as string),
      parentIssueId: parentIssue?.id,
      title: (fd.get('title') as string).trim(),
      jiraId: ((fd.get('jiraId') as string) || '').trim() || undefined,
      description: (fd.get('description') as string).trim() || undefined,
      issueTypeId: fd.get('issueTypeId') as string,
      priorityId: fd.get('priorityId') as string,
      capitalizable: parseOptionalBoolean(fd.get('capitalizable')),
      customFields,
    };
    onSubmit(payload);
  };

  const lockedProjectLabel =
    projects.find((p) => p.id === projectId)?.label ?? projectId;

  const compact = variant === 'panel';
  const inputClass = compact ? rdFieldInputClass : pageInputClass;
  const textareaClass = compact ? rdFieldTextareaClass : pageInputClass;
  const labelText = compact
    ? 'block text-[11px] leading-tight text-text2'
    : 'text-text2';

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? 'space-y-3' : 'card space-y-4 p-6'}
      noValidate
    >
      {parentIssue ? (
        <div
          className={`rounded-lg border border-accent/30 bg-accent/5 ${
            compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
          }`}
        >
          <p className="text-text2">Creating under</p>
          <p className="mt-1 font-medium">{parentIssue.title}</p>
        </div>
      ) : (
        <p className={compact ? 'text-xs text-text2' : 'text-sm text-text2'}>
          Items are created at project level. Assign them to a release later from the project Releases
          tab.
        </p>
      )}

      {lockProject || parentIssue ? (
        <div className={compact ? 'text-xs' : 'text-sm'}>
          <span className="text-text2">Project</span>
          <p className="mt-0.5 font-medium">{lockedProjectLabel}</p>
        </div>
      ) : (
        <label className="block min-w-0">
          <span className={labelText}>Project</span>
          <select
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className={inputClass}
          >
            <option value="" disabled>
              Select project…
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block min-w-0">
        <span className={labelText}>JIRA ID</span>
        <input
          name="jiraId"
          type="text"
          maxLength={80}
          className={inputClass}
          placeholder="e.g. PROJ-123"
        />
      </label>

      <label className="block min-w-0">
        <span className={labelText}>Change Request Name</span>
        <input name="title" type="text" required maxLength={255} className={inputClass} />
      </label>

      <label className="block min-w-0">
        <span className={labelText}>Description</span>
        <textarea
          name="description"
          rows={compact ? 2 : 4}
          className={textareaClass}
          placeholder="Optional details…"
        />
      </label>

      <div className={compact ? 'grid grid-cols-2 gap-x-1.5 gap-y-2 sm:grid-cols-4' : 'grid gap-4 sm:grid-cols-2'}>
        <label className="min-w-0 block">
          <span className={labelText}>Type</span>
          <div className="relative">
            {selectedIssueType && (
              <span
                className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${
                  compact ? 'mt-0.5' : 'mt-0.5 left-3'
                }`}
              >
                <IssueTypeIcon
                  name={selectedIssueType.name}
                  workflowCode={selectedIssueType.workflowCode}
                  size={compact ? 14 : 16}
                />
              </span>
            )}
            <select
              name="issueTypeId"
              required
              value={issueTypeId}
              onChange={(e) => setIssueTypeId(e.target.value)}
              className={`${inputClass} ${selectedIssueType ? (compact ? 'pl-7' : 'pl-9') : ''}`}
            >
              <option value="" disabled>
                Select type…
              </option>
              {availableIssueTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        <label className="min-w-0 block">
          <span className={labelText}>Priority</span>
          <select name="priorityId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Select priority…
            </option>
            {priorities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 block">
          <span className={labelText}>Capitalization</span>
          <select name="capitalizable" className={inputClass} defaultValue="">
            <option value="">Not set</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </label>
      </div>

      <IssueCustomFieldsEditor
        fields={customFieldDefs}
        values={customFields}
        onChange={(key, value) => {
          setCustomFields((prev) => ({ ...prev, [key]: value }));
          setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          });
          setLocalError(null);
        }}
        fieldErrors={fieldErrors}
        compact={compact}
      />

      {localError && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs text-danger">
          {localError}
        </p>
      )}

      <div className={`flex gap-2 ${compact ? 'pt-0.5' : 'pt-2'}`}>
        <button
          type="submit"
          disabled={loading || !projectId}
          className={`font-medium disabled:opacity-50 ${
            compact
              ? 'rounded-md bg-accent px-3 py-1.5 text-xs'
              : 'rounded-lg bg-accent px-4 py-2 text-sm'
          }`}
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Creating…' : 'Create item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={
            compact
              ? 'rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg3'
              : 'rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3'
          }
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
