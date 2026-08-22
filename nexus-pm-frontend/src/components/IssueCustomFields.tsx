import type { ReactNode } from 'react';
import type { IssueFieldDefinition } from '@/api/issueFields.api';
import {
  getDateFieldBounds,
  isNonNegativeNumberField,
  isPercentageCompletionField,
  sanitizeNonNegativeNumberInput,
  sanitizePercentageCompletionInput,
} from '@/utils/issueFieldValidation';
import { formatCustomFieldDisplay } from '@/utils/dateFormat';

/** Compact controls for RD panel grids — accent focus, soft fill. */
export const rdFieldInputClass =
  'mt-0.5 box-border h-6 w-full min-w-0 rounded border border-border bg-bg px-1.5 py-0.5 text-[11px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-[color:var(--accent-muted)]';

export const rdFieldInputErrorClass =
  'mt-0.5 box-border h-6 w-full min-w-0 rounded border border-danger bg-bg px-1.5 py-0.5 text-[11px] text-text outline-none transition focus:border-danger focus:ring-1 focus:ring-danger/30';

export const rdFieldTextareaClass =
  'mt-0.5 box-border w-full min-w-0 rounded border border-border bg-bg px-1.5 py-1 text-[11px] text-text outline-none transition focus:border-accent focus:ring-1 focus:ring-[color:var(--accent-muted)]';

/** Field label above each input — left-aligned and bold. */
export const rdFieldLabelClass =
  'mb-0.5 block truncate px-0.5 py-0.5 text-left text-[10px] font-bold leading-tight text-text';

export const ISSUE_FIELD_SECTION_LABELS: Record<string, string> = {
  GENERAL: 'General',
  DATES: 'Requirement & effort dates',
  FINANCIALS: 'Financials & approvals',
  MAN_DAYS: 'Man-days',
  MILESTONES: 'Project milestones',
  RISK: 'Risk',
  OTHER: 'Other',
};

/** Soft section tint by group — uses theme tokens only. */
const SECTION_TINT: Record<string, string> = {
  GENERAL: 'from-[color:var(--accent-muted)]/50 to-transparent',
  DATES: 'from-sky-500/10 to-transparent',
  FINANCIALS: 'from-emerald-500/10 to-transparent',
  MAN_DAYS: 'from-amber-500/10 to-transparent',
  MILESTONES: 'from-indigo-500/10 to-transparent',
  QUARTERLY_COMPLETION: 'from-cyan-500/10 to-transparent',
  RISK: 'from-rose-500/10 to-transparent',
  OTHER: 'from-[color:var(--bg3)] to-transparent',
};

export function RdSectionCard({
  title,
  children,
  sectionCode,
  mode = 'view',
}: {
  title: string;
  children: ReactNode;
  sectionCode?: string;
  mode?: 'view' | 'edit';
}) {
  const tint = SECTION_TINT[sectionCode ?? 'OTHER'] ?? SECTION_TINT.OTHER;
  return (
    <section
      className={`overflow-hidden rounded-lg border border-border shadow-sm ${
        mode === 'edit' ? 'bg-bg2' : 'bg-bg2'
      }`}
    >
      <div
        className={`border-b border-border bg-gradient-to-r px-2 py-1 ${tint}`}
      >
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          {title}
        </h4>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

export function isRiskSectionField(field: IssueFieldDefinition) {
  return (field.sectionCode?.trim() || '') === 'RISK';
}

export function riskSectionFields(fields: IssueFieldDefinition[]) {
  return fields.filter(isRiskSectionField);
}

export function groupIssueFieldsBySection(
  fields: IssueFieldDefinition[],
  options?: { includeRisk?: boolean },
) {
  const includeRisk = options?.includeRisk ?? false;
  const groups = new Map<string, IssueFieldDefinition[]>();
  for (const field of fields) {
    const key = field.sectionCode?.trim() || 'OTHER';
    // Multi-row risks use IssueRisksSection / rd_issue_risk — skip flat RISK defs
    // unless the caller is rendering them inside that section.
    if (!includeRisk && key === 'RISK') continue;
    // Multi-row notes use IssueNotesSection / rd_issue_note.
    if (field.fieldKey === 'notes') continue;
    const list = groups.get(key) ?? [];
    list.push(field);
    groups.set(key, list);
  }
  return Array.from(groups.entries()).map(([sectionCode, items]) => ({
    sectionCode,
    label: ISSUE_FIELD_SECTION_LABELS[sectionCode] ?? sectionCode,
    items,
  }));
}

function isLongTextField(field: IssueFieldDefinition) {
  return (
    (field.maxLength ?? 0) > 255 ||
    field.fieldKey.includes('notes') ||
    field.fieldKey.includes('description') ||
    field.fieldKey.includes('mitigation')
  );
}

interface IssueCustomFieldsEditorProps {
  fields: IssueFieldDefinition[];
  values: Record<string, string>;
  onChange: (fieldKey: string, value: string) => void;
  /** Dense multi-column layout for RD panels. */
  compact?: boolean;
  /** Per-field validation messages keyed by fieldKey. */
  fieldErrors?: Record<string, string>;
  /** Include RISK-section fields (normally rendered inside IssueRisksSection). */
  includeRisk?: boolean;
  /** When false, render field grids without section cards. */
  wrapSections?: boolean;
}

export function IssueCustomFieldsEditor({
  fields,
  values,
  onChange,
  compact = true,
  fieldErrors = {},
  includeRisk = false,
  wrapSections = true,
}: IssueCustomFieldsEditorProps) {
  if (fields.length === 0) return null;

  const groups = groupIssueFieldsBySection(fields, { includeRisk });
  // Dense: ~6–8 fields per row so most sections fit in 1–2 rows on the half-width RD panel.
  const gridClass = compact
    ? 'grid grid-cols-3 gap-x-1 gap-y-1.5 sm:grid-cols-6 lg:grid-cols-7'
    : 'grid gap-3 sm:grid-cols-2';
  const longSpan = compact ? 'col-span-3 sm:col-span-6 lg:col-span-7' : 'sm:col-span-2';

  return (
    <div className={compact ? 'space-y-2' : 'space-y-5'}>
      {groups.map((group) => {
        const grid = (
          <div className={gridClass}>
            {group.items.map((field) => {
              const value = values[field.fieldKey] ?? '';
              const error = fieldErrors[field.fieldKey];
              const inputClass = error ? rdFieldInputErrorClass : rdFieldInputClass;
              const label = (
                <span className={rdFieldLabelClass}>
                  {field.label}
                  {field.required ? <span className="text-danger"> *</span> : null}
                </span>
              );
              const errorHint = error ? (
                <span className="mt-0.5 block text-[9px] leading-snug text-danger">{error}</span>
              ) : null;

              if (field.dataType === 'DROPDOWN') {
                return (
                  <label
                    key={field.id}
                    className="min-w-0 block"
                    data-issue-field={field.fieldKey}
                  >
                    {label}
                    <select
                      required={field.required}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={inputClass}
                      aria-invalid={!!error}
                    >
                      <option value="">Not set</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    {errorHint}
                  </label>
                );
              }

              if (field.dataType === 'DATE') {
                const bounds = getDateFieldBounds(field.fieldKey, values);
                return (
                  <label
                    key={field.id}
                    className="min-w-0 block"
                    data-issue-field={field.fieldKey}
                  >
                    {label}
                    <input
                      type="date"
                      required={field.required}
                      value={value}
                      min={bounds.min}
                      max={bounds.max}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={inputClass}
                      aria-invalid={!!error}
                      title={
                        bounds.min || bounds.max
                          ? [
                              bounds.min ? `On or after ${bounds.min}` : null,
                              bounds.max ? `On or before ${bounds.max}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')
                          : undefined
                      }
                    />
                    {errorHint}
                  </label>
                );
              }

              if (field.dataType === 'YEAR') {
                return (
                  <label
                    key={field.id}
                    className="min-w-0 block"
                    data-issue-field={field.fieldKey}
                  >
                    {label}
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      step={1}
                      required={field.required}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={inputClass}
                      placeholder="YYYY"
                      aria-invalid={!!error}
                    />
                    {errorHint}
                  </label>
                );
              }

              if (field.dataType === 'NUMBER' || isPercentageCompletionField(field.fieldKey)) {
                const isPct = isPercentageCompletionField(field.fieldKey);
                const nonNegative = isPct || isNonNegativeNumberField(field.fieldKey);
                return (
                  <label
                    key={field.id}
                    className="min-w-0 block"
                    data-issue-field={field.fieldKey}
                  >
                    {label}
                    <input
                      type="number"
                      inputMode="numeric"
                      step={1}
                      min={nonNegative ? 0 : undefined}
                      max={isPct ? 100 : undefined}
                      required={field.required}
                      value={value}
                      onChange={(e) => {
                        const next = isPct
                          ? sanitizePercentageCompletionInput(e.target.value)
                          : nonNegative
                            ? sanitizeNonNegativeNumberInput(e.target.value)
                            : e.target.value;
                        onChange(field.fieldKey, next);
                      }}
                      onBlur={
                        isPct
                          ? () => {
                              if (value === '') return;
                              onChange(field.fieldKey, sanitizePercentageCompletionInput(value));
                            }
                          : nonNegative
                            ? () => {
                                if (value === '') return;
                                onChange(field.fieldKey, sanitizeNonNegativeNumberInput(value));
                              }
                            : undefined
                      }
                      onKeyDown={
                        nonNegative
                          ? (e) => {
                              // Block e/E/+/- which number inputs otherwise allow
                              if (['e', 'E', '+', '-'].includes(e.key)) {
                                e.preventDefault();
                              }
                              // Percentage is integers only
                              if (isPct && e.key === '.') {
                                e.preventDefault();
                              }
                            }
                          : undefined
                      }
                      className={inputClass}
                      placeholder={isPct ? '0–100' : undefined}
                      aria-invalid={!!error}
                    />
                    {errorHint}
                  </label>
                );
              }

              if (isLongTextField(field)) {
                return (
                  <label
                    key={field.id}
                    className={`min-w-0 block ${longSpan}`}
                    data-issue-field={field.fieldKey}
                  >
                    {label}
                    <textarea
                      rows={compact ? 2 : 3}
                      required={field.required}
                      maxLength={field.maxLength ?? undefined}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={rdFieldTextareaClass}
                      aria-invalid={!!error}
                    />
                    {errorHint}
                  </label>
                );
              }

              return (
                <label
                  key={field.id}
                  className="min-w-0 block"
                  data-issue-field={field.fieldKey}
                >
                  {label}
                  <input
                    type="text"
                    required={field.required}
                    maxLength={field.maxLength ?? undefined}
                    value={value}
                    onChange={(e) => onChange(field.fieldKey, e.target.value)}
                    className={inputClass}
                    aria-invalid={!!error}
                  />
                  {errorHint}
                </label>
              );
            })}
          </div>
        );
        if (!wrapSections) {
          return <div key={group.sectionCode}>{grid}</div>;
        }
        return (
          <RdSectionCard
            key={group.sectionCode}
            title={group.label}
            sectionCode={group.sectionCode}
            mode="edit"
          >
            {grid}
          </RdSectionCard>
        );
      })}
    </div>
  );
}

interface IssueCustomFieldsViewProps {
  fields: IssueFieldDefinition[];
  values?: Record<string, string> | null;
  includeRisk?: boolean;
  wrapSections?: boolean;
}

export function IssueCustomFieldsView({
  fields,
  values,
  includeRisk = false,
  wrapSections = true,
}: IssueCustomFieldsViewProps) {
  if (!fields.length) {
    return wrapSections ? (
      <p className="text-xs text-text2">No additional fields configured.</p>
    ) : null;
  }

  const map = values ?? {};
  const groups = groupIssueFieldsBySection(fields, { includeRisk });

  return (
    <div className="space-y-2">
      {groups.map((group) => {
        const grid = (
          <dl className="grid grid-cols-3 gap-1 text-[11px] sm:grid-cols-6 lg:grid-cols-7">
            {group.items.map((field) => {
              const raw = (map[field.fieldKey] ?? '').trim();
              const display = formatCustomFieldDisplay(field, raw);
              const isLong =
                field.fieldKey.includes('notes') ||
                field.fieldKey.includes('description') ||
                field.fieldKey.includes('mitigation');
              return (
                <div
                  key={field.id}
                  className={`min-w-0 rounded border border-border/80 bg-bg px-1.5 py-1 ${
                    isLong ? 'col-span-3 sm:col-span-6 lg:col-span-7' : ''
                  }`}
                >
                  <dt className="mb-0.5 truncate px-0.5 py-0.5 text-left text-[9px] font-bold uppercase tracking-wide text-text">
                    {field.label}
                  </dt>
                  <dd
                    className={`mt-0.5 whitespace-pre-wrap break-words text-[11px] leading-snug ${
                      raw ? 'font-medium text-text' : 'text-text3'
                    }`}
                  >
                    {display}
                  </dd>
                </div>
              );
            })}
          </dl>
        );
        if (!wrapSections) {
          return <div key={group.sectionCode}>{grid}</div>;
        }
        return (
          <RdSectionCard
            key={group.sectionCode}
            title={group.label}
            sectionCode={group.sectionCode}
            mode="view"
          >
            {grid}
          </RdSectionCard>
        );
      })}
    </div>
  );
}
