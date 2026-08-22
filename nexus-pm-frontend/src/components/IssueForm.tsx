import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CreateIssuePayload } from '@/hooks/useIssues';
import type { Priority, IssueType } from '@/api/lookup.api';
import type { IssueNote } from '@/api/issueNotes.api';
import type { IssueRisk } from '@/api/issueRisks.api';
import type { IssueQuarterlyCompletion } from '@/api/issueQuarterlyCompletions.api';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { filterIssueTypesForParent } from '@/utils/issueHierarchy';
import { fetchActiveIssueFields } from '@/api/issueFields.api';
import {
  IssueCustomFieldsEditor,
  rdFieldInputClass,
  rdFieldInputErrorClass,
  rdFieldLabelClass,
  rdFieldTextareaClass,
} from '@/components/IssueCustomFields';
import { IssueNotesSection } from '@/components/IssueNotesSection';
import { IssueQuarterlyCompletionSection } from '@/components/IssueQuarterlyCompletionSection';
import { IssueRisksSection } from '@/components/IssueRisksSection';
import {
  type IssueCreateChildRows,
} from '@/utils/issueCreateChildren';
import {
  firstCustomFieldErrorMessage,
  firstFieldErrorKey,
  scrollToIssueField,
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
  onSubmit: (payload: CreateIssuePayload, extras?: IssueCreateChildRows) => void;
}

const pageInputClass =
  'mt-1 w-full rounded-lg border border-border bg-bg3 px-3 py-2 text-sm outline-none focus:border-accent';

const pageInputErrorClass =
  'mt-1 w-full rounded-lg border border-danger bg-bg3 px-3 py-2 text-sm outline-none focus:border-danger';

const CORE_FIELD_ORDER = ['projectId', 'title', 'issueTypeId', 'priorityId'] as const;

function parseOptionalBoolean(value: FormDataEntryValue | null): boolean | undefined {
  if (value == null || value === '') return undefined;
  return value === 'true';
}

function fieldHint(message: string | undefined, compact: boolean) {
  if (!message) return null;
  return (
    <span
      className={
        compact
          ? 'mt-0.5 block text-[9px] leading-snug text-danger'
          : 'mt-1 block text-xs text-danger'
      }
    >
      {message}
    </span>
  );
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
  const [priorityId, setPriorityId] = useState('');
  const [title, setTitle] = useState('');
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<IssueNote[]>([]);
  const [draftQuarters, setDraftQuarters] = useState<IssueQuarterlyCompletion[]>([]);
  const [draftRisks, setDraftRisks] = useState<IssueRisk[]>([]);
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

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setLocalError(null);
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const resolvedProjectId = projectId || ((fd.get('projectId') as string) ?? '');
    const trimmedTitle = title.trim() || ((fd.get('title') as string) ?? '').trim();
    const resolvedTypeId = issueTypeId || ((fd.get('issueTypeId') as string) ?? '');
    const resolvedPriorityId = priorityId || ((fd.get('priorityId') as string) ?? '');

    const errors: Record<string, string> = {};
    if (!lockProject && !parentIssue && !resolvedProjectId) {
      errors.projectId = 'Project is required';
    }
    if (!trimmedTitle) {
      errors.title = 'Change Request Name is required';
    }
    if (!resolvedTypeId) {
      errors.issueTypeId = 'Type is required';
    }
    if (!resolvedPriorityId) {
      errors.priorityId = 'Priority is required';
    }

    const customErrors = validateIssueCustomFields(customFields, customFieldDefs);
    Object.assign(errors, customErrors);

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setLocalError(firstCustomFieldErrorMessage(errors));
      const firstKey = firstFieldErrorKey(errors, [
        ...CORE_FIELD_ORDER,
        ...customFieldDefs.map((f) => f.fieldKey),
      ]);
      if (firstKey) {
        requestAnimationFrame(() => scrollToIssueField(firstKey));
      }
      return;
    }
    setLocalError(null);

    const payload: CreateIssuePayload = {
      projectId: resolvedProjectId,
      parentIssueId: parentIssue?.id,
      title: trimmedTitle,
      jiraId: ((fd.get('jiraId') as string) || '').trim() || undefined,
      bmsId: ((fd.get('bmsId') as string) || '').trim() || undefined,
      description: (fd.get('description') as string).trim() || undefined,
      issueTypeId: resolvedTypeId,
      priorityId: resolvedPriorityId,
      capitalizable: parseOptionalBoolean(fd.get('capitalizable')),
      customFields,
    };
    const extras: IssueCreateChildRows = {
      notes: draftNotes.map((row) => ({ date: row.date, note: row.note })),
      quarterlyCompletions: draftQuarters.map((row) => ({
        year: row.year,
        quarter: row.quarter,
        percentage: Number(row.percentage),
      })),
      risks: draftRisks.map((row) => ({
        description: row.description?.trim() || undefined,
        createdDate: row.createdDate || undefined,
        owner: row.owner?.trim() || undefined,
        status: row.status || undefined,
        impact: row.impact || undefined,
        closedDate: row.closedDate || undefined,
        mitigation: row.mitigation?.trim() || undefined,
      })),
    };
    onSubmit(payload, extras);
  };

  const lockedProjectLabel =
    projects.find((p) => p.id === projectId)?.label ?? projectId;

  const compact = variant === 'panel';
  const inputClass = compact ? rdFieldInputClass : pageInputClass;
  const inputErrorClass = compact ? rdFieldInputErrorClass : pageInputErrorClass;
  const textareaClass = compact ? rdFieldTextareaClass : pageInputClass;
  const labelText = compact ? rdFieldLabelClass : 'text-text2';

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? 'space-y-2.5' : 'card space-y-4 p-6'}
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
          <span className={compact ? rdFieldLabelClass : 'text-text2'}>Project</span>
          <p className="mt-0.5 font-medium">{lockedProjectLabel}</p>
        </div>
      ) : (
        <label className="block min-w-0" data-issue-field="projectId">
          <span className={labelText}>
            Project <span className="text-danger">*</span>
          </span>
          <select
            name="projectId"
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              clearFieldError('projectId');
            }}
            required
            className={fieldErrors.projectId ? inputErrorClass : inputClass}
            aria-invalid={!!fieldErrors.projectId}
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
          {fieldHint(fieldErrors.projectId, compact)}
        </label>
      )}

      <div
        className={
          compact
            ? 'overflow-hidden rounded-lg border border-accent/30 bg-bg2 shadow-sm'
            : undefined
        }
      >
        {compact ? (
          <div className="border-b border-accent/20 bg-gradient-to-r from-[color:var(--accent-muted)] to-transparent px-2.5 py-1.5">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-accent">
              New RD
            </h3>
          </div>
        ) : null}
        <div className={compact ? 'space-y-2.5 p-2.5' : 'space-y-4'}>
          <div
            className={`grid ${compact ? 'grid-cols-2 gap-x-1 gap-y-1.5' : 'grid-cols-1 gap-4 sm:grid-cols-2'}`}
          >
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
              <span className={labelText}>BMS ID</span>
              <input name="bmsId" type="text" maxLength={80} className={inputClass} />
            </label>
          </div>

          <label className="block min-w-0" data-issue-field="title">
            <span className={labelText}>
              Change Request Name <span className="text-danger">*</span>
            </span>
            <input
              name="title"
              type="text"
              required
              maxLength={255}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError('title');
              }}
              className={fieldErrors.title ? inputErrorClass : inputClass}
              aria-invalid={!!fieldErrors.title}
            />
            {fieldHint(fieldErrors.title, compact)}
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

          <div
            className={
              compact
                ? 'grid grid-cols-3 gap-x-1 gap-y-1.5 sm:grid-cols-6'
                : 'grid gap-4 sm:grid-cols-2'
            }
          >
            <label className="min-w-0 block" data-issue-field="issueTypeId">
              <span className={labelText}>
                Type <span className="text-danger">*</span>
              </span>
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
                  onChange={(e) => {
                    setIssueTypeId(e.target.value);
                    clearFieldError('issueTypeId');
                  }}
                  className={`${fieldErrors.issueTypeId ? inputErrorClass : inputClass} ${
                    selectedIssueType ? (compact ? 'pl-7' : 'pl-9') : ''
                  }`}
                  aria-invalid={!!fieldErrors.issueTypeId}
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
              {fieldHint(fieldErrors.issueTypeId, compact)}
            </label>
            <label className="min-w-0 block" data-issue-field="priorityId">
              <span className={labelText}>
                Priority <span className="text-danger">*</span>
              </span>
              <select
                name="priorityId"
                required
                className={fieldErrors.priorityId ? inputErrorClass : inputClass}
                value={priorityId}
                onChange={(e) => {
                  setPriorityId(e.target.value);
                  clearFieldError('priorityId');
                }}
                aria-invalid={!!fieldErrors.priorityId}
              >
                <option value="" disabled>
                  Select priority…
                </option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              {fieldHint(fieldErrors.priorityId, compact)}
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
        </div>
      </div>

      <IssueCustomFieldsEditor
        fields={customFieldDefs}
        values={customFields}
        onChange={(key, value) => {
          setCustomFields((prev) => ({ ...prev, [key]: value }));
          clearFieldError(key);
        }}
        fieldErrors={fieldErrors}
        compact={compact}
      />

      <IssueNotesSection
        mode="edit"
        localRows={draftNotes}
        onLocalRowsChange={setDraftNotes}
      />

      <IssueQuarterlyCompletionSection
        mode="edit"
        localRows={draftQuarters}
        onLocalRowsChange={setDraftQuarters}
      />

      <IssueRisksSection
        mode="edit"
        localRows={draftRisks}
        onLocalRowsChange={setDraftRisks}
        customFields={customFieldDefs}
        customFieldValues={customFields}
        onCustomFieldChange={(key, value) => {
          setCustomFields((prev) => ({ ...prev, [key]: value }));
          clearFieldError(key);
        }}
        customFieldErrors={fieldErrors}
      />

      {localError && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-2 py-1.5 text-xs text-danger">
          {localError}
        </p>
      )}

      <div
        className={
          compact
            ? 'sticky bottom-0 z-[1] -mx-0.5 flex gap-2 border-t border-border bg-bg2/95 px-0.5 py-2 backdrop-blur-sm'
            : 'flex gap-2 pt-2'
        }
      >
        <button
          type="submit"
          disabled={loading}
          className={`font-medium disabled:opacity-50 ${
            compact
              ? 'rounded-md bg-accent px-3 py-1.5 text-xs shadow-sm'
              : 'rounded-lg bg-accent px-4 py-2 text-sm'
          }`}
          style={{ color: 'var(--accent-fg)' }}
        >
          {loading ? 'Creating…' : 'Create item'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className={
            compact
              ? 'rounded-md border border-border bg-bg3 px-3 py-1.5 text-xs hover:bg-bg disabled:opacity-50'
              : 'rounded-lg border border-border px-4 py-2 text-sm hover:bg-bg3'
          }
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
