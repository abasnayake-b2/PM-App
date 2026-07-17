import type { ReactNode } from 'react';
import type { IssueFieldDefinition } from '@/api/issueFields.api';

/** Compact controls for RD panel grids — accent focus, soft fill. */
export const rdFieldInputClass =
  'mt-0.5 box-border h-8 w-full min-w-0 rounded-md border border-border bg-bg px-2 py-1 text-xs text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[color:var(--accent-muted)]';

export const rdFieldTextareaClass =
  'mt-0.5 box-border w-full min-w-0 rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none transition focus:border-accent focus:ring-2 focus:ring-[color:var(--accent-muted)]';

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
        className={`border-b border-border bg-gradient-to-r px-2.5 py-1.5 ${tint}`}
      >
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-accent">
          {title}
        </h4>
      </div>
      <div className="p-2.5">{children}</div>
    </section>
  );
}

export function groupIssueFieldsBySection(fields: IssueFieldDefinition[]) {
  const groups = new Map<string, IssueFieldDefinition[]>();
  for (const field of fields) {
    const key = field.sectionCode?.trim() || 'OTHER';
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
}

export function IssueCustomFieldsEditor({
  fields,
  values,
  onChange,
  compact = true,
}: IssueCustomFieldsEditorProps) {
  if (fields.length === 0) return null;

  const groups = groupIssueFieldsBySection(fields);
  const gridClass = compact
    ? 'grid grid-cols-2 gap-x-1.5 gap-y-2 sm:grid-cols-4'
    : 'grid gap-3 sm:grid-cols-2';
  const longSpan = compact ? 'col-span-2 sm:col-span-4' : 'sm:col-span-2';

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-5'}>
      {groups.map((group) => (
        <RdSectionCard
          key={group.sectionCode}
          title={group.label}
          sectionCode={group.sectionCode}
          mode="edit"
        >
          <div className={gridClass}>
            {group.items.map((field) => {
              const value = values[field.fieldKey] ?? '';
              const label = (
                <span
                  className={`block truncate font-medium leading-tight text-text2 ${
                    compact ? 'text-[11px]' : 'text-sm'
                  }`}
                >
                  {field.label}
                  {field.required ? <span className="text-danger"> *</span> : null}
                </span>
              );

              if (field.dataType === 'DROPDOWN') {
                return (
                  <label key={field.id} className="min-w-0 block">
                    {label}
                    <select
                      required={field.required}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={rdFieldInputClass}
                    >
                      <option value="">Not set</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (field.dataType === 'DATE') {
                return (
                  <label key={field.id} className="min-w-0 block">
                    {label}
                    <input
                      type="date"
                      required={field.required}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={rdFieldInputClass}
                    />
                  </label>
                );
              }

              if (field.dataType === 'YEAR') {
                return (
                  <label key={field.id} className="min-w-0 block">
                    {label}
                    <input
                      type="number"
                      min={2000}
                      max={2100}
                      step={1}
                      required={field.required}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={rdFieldInputClass}
                      placeholder="YYYY"
                    />
                  </label>
                );
              }

              if (field.dataType === 'NUMBER') {
                return (
                  <label key={field.id} className="min-w-0 block">
                    {label}
                    <input
                      type="number"
                      step="any"
                      required={field.required}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={rdFieldInputClass}
                    />
                  </label>
                );
              }

              if (isLongTextField(field)) {
                return (
                  <label key={field.id} className={`min-w-0 block ${longSpan}`}>
                    {label}
                    <textarea
                      rows={compact ? 2 : 3}
                      required={field.required}
                      maxLength={field.maxLength ?? undefined}
                      value={value}
                      onChange={(e) => onChange(field.fieldKey, e.target.value)}
                      className={rdFieldTextareaClass}
                    />
                  </label>
                );
              }

              return (
                <label key={field.id} className="min-w-0 block">
                  {label}
                  <input
                    type="text"
                    required={field.required}
                    maxLength={field.maxLength ?? undefined}
                    value={value}
                    onChange={(e) => onChange(field.fieldKey, e.target.value)}
                    className={rdFieldInputClass}
                  />
                </label>
              );
            })}
          </div>
        </RdSectionCard>
      ))}
    </div>
  );
}

interface IssueCustomFieldsViewProps {
  fields: IssueFieldDefinition[];
  values?: Record<string, string> | null;
}

export function IssueCustomFieldsView({ fields, values }: IssueCustomFieldsViewProps) {
  if (!fields.length) {
    return <p className="text-xs text-text2">No additional fields configured.</p>;
  }

  const map = values ?? {};
  const groups = groupIssueFieldsBySection(fields);

  return (
    <div className="space-y-2.5">
      {groups.map((group) => (
        <RdSectionCard
          key={group.sectionCode}
          title={group.label}
          sectionCode={group.sectionCode}
          mode="view"
        >
          <dl className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-4">
            {group.items.map((field) => {
              const raw = (map[field.fieldKey] ?? '').trim();
              return (
                <div
                  key={field.id}
                  className="min-w-0 rounded-md border border-border/80 bg-bg px-2 py-1.5"
                >
                  <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-text2">
                    {field.label}
                  </dt>
                  <dd
                    className={`mt-0.5 whitespace-pre-wrap break-words text-xs ${
                      raw ? 'font-medium text-text' : 'text-text3'
                    }`}
                  >
                    {raw || '—'}
                  </dd>
                </div>
              );
            })}
          </dl>
        </RdSectionCard>
      ))}
    </div>
  );
}
