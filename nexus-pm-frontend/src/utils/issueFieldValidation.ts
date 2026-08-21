/** RD custom-field validation shared by edit/create forms. */

const FIELD_LABELS: Record<string, string> = {
  percentage_completion: 'Percentage Completion',
  ba_ballpark_effort: 'BA Ballpark Effort',
  bp_effort: 'BP Effort',
  md_planned: 'Man-days Planned',
  md_additional: 'Man-days Additional',
  md_total: 'Man-days Total',
  md_actually_utilized: 'Man-days Actually Utilized',
  md_remaining: 'Man-days Remaining',
  over_utilization_pct: 'Over Utilization %',
  completion_based_on_actual_effort: 'Completion based on Actual Effort',
  latest_client_acknowledged_percentage: 'Latest client acknowledged percentage',
  completion_70_pct_based_on_actual_effort: '70% of Completion based on Actual effort',
  risk_count: 'Risk Count',
  release_count: 'Release Count',
  uat_defect_count: 'UAT Defect Count',
  requirement_initiated_date: 'Requirement Initiated Date',
  brd_requested_date: 'BRD Requested Date',
  brd_received_date: 'BRD Received Date',
  bp_effort_eta: 'BP Effort ETA',
  bp_effort_accepted_date: 'BP Effort Accepted Date',
  total_effort_eta: 'Total Effort ETA',
  rd_start_date: 'RD Start Date',
  rd_delivery_eta: 'RD Delivery ETA',
  rd_sign_off_date: 'RD Sign Off Date',
  quotation_shared_date: 'Quotation Shared Date',
  quotation_approved_date: 'Quotation Accepted Date',
  dev_start_date: 'Dev Start Date',
  dev_end_date: 'Dev End Date',
  sit_start_date: 'SIT Start Date',
  sit_end_date: 'SIT End Date',
  uat_start_date: 'UAT Start Date',
  uat_end_date: 'UAT End Date',
  prod_date: 'Prod Date',
  highlevel_rd_delivery_eta: 'Highlevel RD Delivery ETA',
  pending_highlevel_rd_signoff: 'Pending Highlevel RD Signoff',
  requirement_audit_date: 'Requirement Audit Date',
  next_uat_release: 'Next UAT Release',
  next_production_release: 'Next Production Release',
  release_audit_date: 'Release Audit Date',
  last_action_date: 'Last Action date',
};

/**
 * Single delivery timeline: each filled date must be on or after earlier filled dates.
 * Empty fields are skipped so partial timelines still validate.
 */
export const DATE_CHAINS: string[][] = [
  [
    'requirement_initiated_date',
    'brd_requested_date',
    'brd_received_date',
    'bp_effort_eta',
    'bp_effort_accepted_date',
    'total_effort_eta',
    'rd_start_date',
    'rd_delivery_eta',
    'rd_sign_off_date',
    'quotation_shared_date',
    'quotation_approved_date',
    'dev_start_date',
    'dev_end_date',
    'sit_start_date',
    'sit_end_date',
    'uat_start_date',
    'uat_end_date',
    'prod_date',
  ],
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string | undefined | null): value is string {
  return !!value && ISO_DATE.test(value.trim());
}

/**
 * Calendar bounds for a date field from its chain:
 * min = latest filled earlier date, max = earliest filled later date.
 */
export function getDateFieldBounds(
  fieldKey: string,
  values: Record<string, string>,
): { min?: string; max?: string } {
  const chain = DATE_CHAINS.find((c) => c.includes(fieldKey));
  if (!chain) return {};

  const index = chain.indexOf(fieldKey);
  let min: string | undefined;
  let max: string | undefined;

  for (let i = 0; i < index; i++) {
    const raw = (values[chain[i]] ?? '').trim();
    if (!isIsoDate(raw)) continue;
    if (!min || raw > min) min = raw;
  }

  for (let i = index + 1; i < chain.length; i++) {
    const raw = (values[chain[i]] ?? '').trim();
    if (!isIsoDate(raw)) continue;
    if (!max || raw < max) max = raw;
  }

  // Guard inconsistent existing data so the picker still opens
  if (min && max && min > max) {
    return { min, max: undefined };
  }

  return { min, max };
}

export function fieldLabel(fieldKey: string): string {
  return FIELD_LABELS[fieldKey] ?? fieldKey;
}

export function isPercentageCompletionField(fieldKey: string): boolean {
  return fieldKey === 'percentage_completion';
}

/** Effort / man-days fields that must be ≥ 0. */
const NON_NEGATIVE_NUMBER_FIELDS = new Set([
  'ba_ballpark_effort',
  'bp_effort',
  'md_planned',
  'md_additional',
  'md_total',
  'md_actually_utilized',
  'md_remaining',
  'over_utilization_pct',
  'completion_based_on_actual_effort',
  'latest_client_acknowledged_percentage',
  'completion_70_pct_based_on_actual_effort',
  'risk_count',
  'release_count',
  'uat_defect_count',
]);

export function isNonNegativeNumberField(fieldKey: string): boolean {
  return NON_NEGATIVE_NUMBER_FIELDS.has(fieldKey);
}

/**
 * Keep only a non-negative number (optional decimals). Empty string allowed.
 * Strips minus / scientific notation so negatives cannot be entered.
 */
export function sanitizeNonNegativeNumberInput(raw: string): string {
  if (raw == null || raw === '') return '';
  let next = String(raw).replace(/[eE+\-]/g, '');
  // Allow a single decimal point
  const firstDot = next.indexOf('.');
  if (firstDot !== -1) {
    next =
      next.slice(0, firstDot + 1) + next.slice(firstDot + 1).replace(/\./g, '');
  }
  next = next.replace(/[^\d.]/g, '');
  if (next === '' || next === '.') return next === '.' ? '0.' : '';
  const n = Number(next);
  if (!Number.isFinite(n) || n < 0) return '0';
  return next;
}

/**
 * Restrict Percentage Completion input to digits and clamp to 0–100 while typing.
 * Empty string is allowed (cleared field).
 */
export function sanitizePercentageCompletionInput(raw: string): string {
  if (raw == null || raw === '') return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits === '') return '';
  // Max meaningful length is 3 ("100"); longer inputs collapse to 100
  const n = Number.parseInt(digits.slice(0, 3), 10);
  if (!Number.isFinite(n)) return '';
  if (n > 100) return '100';
  return String(n);
}

export interface IssueFieldRequiredDef {
  fieldKey: string;
  label: string;
  required: boolean;
}

/** Required custom fields that are empty. */
export function validateRequiredCustomFields(
  fields: IssueFieldRequiredDef[],
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!field.required) continue;
    if (!(values[field.fieldKey] ?? '').trim()) {
      errors[field.fieldKey] = `${field.label} is required`;
    }
  }
  return errors;
}

/** Returns per-field error messages. Empty object means valid. */
export function validateIssueCustomFields(
  values: Record<string, string>,
  fieldDefs?: IssueFieldRequiredDef[],
): Record<string, string> {
  const errors: Record<string, string> = fieldDefs
    ? validateRequiredCustomFields(fieldDefs, values)
    : {};

  const pctRaw = (values.percentage_completion ?? '').trim();
  if (pctRaw) {
    if (!/^-?\d+(\.\d+)?$/.test(pctRaw)) {
      errors.percentage_completion = 'Must be a number between 0 and 100';
    } else {
      const n = Number(pctRaw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        errors.percentage_completion = 'Must be a number between 0 and 100';
      }
    }
  }

  for (const key of NON_NEGATIVE_NUMBER_FIELDS) {
    const raw = (values[key] ?? '').trim();
    if (!raw) continue;
    if (!/^\d+(\.\d+)?$/.test(raw)) {
      errors[key] = `${fieldLabel(key)} must be zero or greater`;
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      errors[key] = `${fieldLabel(key)} must be zero or greater`;
    }
  }

  for (const chain of DATE_CHAINS) {
    const filled: { key: string; date: string }[] = [];
    for (const key of chain) {
      const raw = (values[key] ?? '').trim();
      if (!raw) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        errors[key] = `${fieldLabel(key)} must be a valid date`;
        continue;
      }
      filled.push({ key, date: raw });
    }
    for (let i = 0; i < filled.length - 1; i++) {
      const earlier = filled[i];
      const later = filled[i + 1];
      if (earlier.date > later.date) {
        errors[later.key] =
          `${fieldLabel(later.key)} must be on or after ${fieldLabel(earlier.key)}`;
      }
    }
  }

  return errors;
}

export function firstCustomFieldErrorMessage(
  errors: Record<string, string>,
): string | null {
  const first = Object.values(errors)[0];
  return first ?? null;
}

/** First error key in preferred order, then remaining keys. */
export function firstFieldErrorKey(
  errors: Record<string, string>,
  preferredOrder: string[] = [],
): string | null {
  for (const key of preferredOrder) {
    if (errors[key]) return key;
  }
  return Object.keys(errors)[0] ?? null;
}

/** Scroll the labeled field (or its control) into view inside slide-overs / long forms. */
export function scrollToIssueField(fieldKey: string) {
  const el = document.querySelector<HTMLElement>(`[data-issue-field="${fieldKey}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const focusable = el.matches('input, select, textarea')
    ? el
    : el.querySelector<HTMLElement>('input, select, textarea');
  focusable?.focus({ preventScroll: true });
}
