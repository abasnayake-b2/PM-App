import type { Issue } from '@/types';

export function issueDisplayKey(issue: Issue): string {
  if (issue.displayKey?.trim()) {
    return issue.displayKey.trim();
  }
  // Legacy fallback before backfill / API upgrade
  const suffix = issue.id.replace(/-/g, '').slice(-4).toUpperCase();
  return `IX-${suffix}`;
}

/** Primary assignee label: resource allocations take precedence over legacy assignee field. */
export function issueAssigneeName(issue: Issue): string | undefined {
  return issue.allocatedToNames ?? issue.assignedToName ?? undefined;
}

/** True when the query looks like an issue-key or legacy IX-/UUID search. */
export function looksLikeIssueIdSearch(query: string): boolean {
  const raw = query.trim();
  if (!raw) return false;
  if (/-rd-\d+/i.test(raw) || /-ts-\d+/i.test(raw)) return true;
  const compact = raw.replace(/[\s-]/g, '');
  if (/^ix/i.test(compact)) {
    const hex = compact.slice(2);
    return hex.length > 0 && /^[0-9a-f]+$/i.test(hex);
  }
  return compact.length >= 3 && /^[0-9a-f]+$/i.test(compact);
}

function issueIdMatchesQuery(issue: Issue, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return false;

  const displayKey = issueDisplayKey(issue).toLowerCase();
  if (displayKey === needle || displayKey.includes(needle)) return true;

  const compactNeedle = needle.replace(/[\s-]/g, '');
  const compactKey = displayKey.replace(/[\s-]/g, '');
  if (compactKey.includes(compactNeedle) && compactNeedle.length >= 2) return true;

  const idHex = issue.id.replace(/-/g, '').toLowerCase();
  if (/^ix/i.test(compactNeedle)) {
    const hex = compactNeedle.slice(2);
    if (hex && idHex.endsWith(hex)) return true;
  } else if (compactNeedle.length >= 4 && idHex.endsWith(compactNeedle)) {
    return true;
  }
  return false;
}

/** Case-insensitive match for backlog / tracker search boxes (title, ID, type, assignee, …). */
export function issueMatchesSearch(issue: Issue, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;

  if (issueIdMatchesQuery(issue, needle)) return true;

  const fields = [
    issue.title,
    issue.projectName,
    issue.statusName,
    issue.priorityLabel,
    issue.issueTypeName,
    issue.issueTypeWorkflowCode,
    issue.component,
    issue.releaseName,
    issueAssigneeName(issue),
    issue.reportedByName,
  ];
  return fields.some((value) => value?.toLowerCase().includes(needle));
}

/**
 * Filter issues by search; keep ancestors of matches so tree hierarchy still shows.
 */
export function filterIssuesBySearch(issues: Issue[], query: string): Issue[] {
  const needle = query.trim();
  if (!needle) return issues;

  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const keep = new Set<string>();

  for (const issue of issues) {
    if (!issueMatchesSearch(issue, needle)) continue;
    keep.add(issue.id);
    let parentId = issue.parentIssueId;
    while (parentId) {
      keep.add(parentId);
      parentId = byId.get(parentId)?.parentIssueId;
    }
  }

  return issues.filter((issue) => keep.has(issue.id));
}
