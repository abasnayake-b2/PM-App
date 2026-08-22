const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse common stored/display date strings without timezone shift. */
export function parseDateParts(value: string): { year: number; month: number; day: number } | null {
  const raw = value.trim();
  if (!raw || raw === '—' || raw === '-') return null;

  let m = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/.exec(raw);
  if (m) {
    return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  }

  m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(raw);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (!month) return null;
    let year = Number(m[3]);
    if (year < 100) year += 2000;
    return { year, month, day: Number(m[1]) };
  }

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (m) {
    return { year: Number(m[3]), month: Number(m[1]), day: Number(m[2]) };
  }

  return null;
}

/** Display dates as mm/dd/yyyy. Empty values stay as an em dash. */
export function formatMmDdYyyy(value: string | null | undefined): string {
  if (value == null) return '—';
  const trimmed = String(value).trim();
  if (!trimmed || trimmed === '—') return '—';
  const parts = parseDateParts(trimmed);
  if (!parts) return trimmed;
  return `${pad2(parts.month)}/${pad2(parts.day)}/${parts.year}`;
}

export function looksLikeDateFieldKey(fieldKey: string): boolean {
  return (
    fieldKey.includes('_date') ||
    fieldKey.endsWith('_eta') ||
    fieldKey.endsWith('_release') ||
    fieldKey.endsWith('_signoff')
  );
}

export function isDateFieldDefinition(field: { dataType?: string; fieldKey?: string }): boolean {
  return (
    String(field.dataType ?? '').toUpperCase() === 'DATE' ||
    (!!field.fieldKey && looksLikeDateFieldKey(field.fieldKey))
  );
}

/** View-only display for a custom field. Date fields render as mm/dd/yyyy. */
export function formatCustomFieldDisplay(
  field: { dataType?: string; fieldKey?: string },
  value: string | null | undefined,
): string {
  const raw = value == null ? '' : String(value).trim();
  if (!raw) return '—';
  if (isDateFieldDefinition(field) || parseDateParts(raw)) {
    return formatMmDdYyyy(raw);
  }
  return raw;
}
