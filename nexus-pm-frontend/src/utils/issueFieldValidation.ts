/** RD custom-field validation shared by edit/create forms. */

const FIELD_LABELS: Record<string, string> = {
  percentage_completion: 'Percentage Completion',
  requirement_initiated_date: 'Requirement Initiated Date',
  brd_requested_date: 'BRD Requested Date',
  brd_received_date: 'BRD Received Date',
  rd_start_date: 'RD Start Date',
  rd_delivery_eta: 'RD Delivery ETA',
  rd_sign_off_date: 'RD Sign Off Date',
  bp_effort_eta: 'BP Effort ETA',
  bp_effort_accepted_date: 'BP Effort Accepted Date',
  total_effort_eta: 'Total Effort ETA',
  dev_start_date: 'Dev Start Date',
  dev_end_date: 'Dev End Date',
  sit_start_date: 'SIT Start Date',
  sit_end_date: 'SIT End Date',
  uat_start_date: 'UAT Start Date',
  uat_end_date: 'UAT End Date',
  prod_date: 'Prod Date',
  risk_created_date: 'Risk Created Date',
  risk_closed_date: 'Risk Closed Date',
};

/** Ordered date chains: each filled date must be on or after earlier filled dates in the chain. */
export const DATE_CHAINS: string[][] = [
  [
    'requirement_initiated_date',
    'brd_requested_date',
    'brd_received_date',
    'rd_start_date',
    'rd_delivery_eta',
    'rd_sign_off_date',
  ],
  ['bp_effort_eta', 'bp_effort_accepted_date', 'total_effort_eta'],
  [
    'dev_start_date',
    'dev_end_date',
    'sit_start_date',
    'sit_end_date',
    'uat_start_date',
    'uat_end_date',
    'prod_date',
  ],
  ['risk_created_date', 'risk_closed_date'],
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

/** Returns per-field error messages. Empty object means valid. */
export function validateIssueCustomFields(
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};

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
