import type { Issue } from '@/types';

const TYPE_ORDER = ['EPIC', 'STORY', 'TASK', 'CHANGE', 'BUG'];

export interface IssueTreeRow {
  issue: Issue;
  depth: number;
  hasChildren: boolean;
  childCount: number;
}

function compareIssues(a: Issue, b: Issue): number {
  const projectCmp = (a.projectName ?? '').localeCompare(b.projectName ?? '', undefined, {
    sensitivity: 'base',
  });
  if (projectCmp !== 0) return projectCmp;

  const rdA = a.rdNumber ?? Number.MAX_SAFE_INTEGER;
  const rdB = b.rdNumber ?? Number.MAX_SAFE_INTEGER;
  if (rdA !== rdB) return rdA - rdB;

  const childA = a.childNumber ?? 0;
  const childB = b.childNumber ?? 0;
  if (childA !== childB) return childA - childB;

  const typeA = TYPE_ORDER.indexOf(a.issueTypeWorkflowCode?.toUpperCase() ?? 'ZZ');
  const typeB = TYPE_ORDER.indexOf(b.issueTypeWorkflowCode?.toUpperCase() ?? 'ZZ');
  const normalizedTypeA = typeA >= 0 ? typeA : TYPE_ORDER.length;
  const normalizedTypeB = typeB >= 0 ? typeB : TYPE_ORDER.length;
  if (normalizedTypeA !== normalizedTypeB) return normalizedTypeA - normalizedTypeB;

  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
}

export function buildIssueTreeRows(issues: Issue[], collapsedIds: ReadonlySet<string>): IssueTreeRow[] {
  if (issues.length === 0) return [];

  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const childrenByParent = new Map<string, Issue[]>();

  for (const issue of issues) {
    if (issue.parentIssueId && byId.has(issue.parentIssueId)) {
      const siblings = childrenByParent.get(issue.parentIssueId) ?? [];
      siblings.push(issue);
      childrenByParent.set(issue.parentIssueId, siblings);
    }
  }

  for (const children of childrenByParent.values()) {
    children.sort(compareIssues);
  }

  const roots = issues
    .filter((issue) => !issue.parentIssueId || !byId.has(issue.parentIssueId))
    .sort(compareIssues);

  const rows: IssueTreeRow[] = [];

  const walk = (issue: Issue, depth: number) => {
    const children = childrenByParent.get(issue.id) ?? [];
    const hasChildren = children.length > 0;
    rows.push({ issue, depth, hasChildren, childCount: children.length });

    if (hasChildren && !collapsedIds.has(issue.id)) {
      for (const child of children) {
        walk(child, depth + 1);
      }
    }
  };

  for (const root of roots) {
    walk(root, 0);
  }

  return rows;
}

export function collectParentIdsWithChildren(issues: Issue[]): string[] {
  const childParentIds = new Set<string>();
  const issueIds = new Set(issues.map((issue) => issue.id));

  for (const issue of issues) {
    if (issue.parentIssueId && issueIds.has(issue.parentIssueId)) {
      childParentIds.add(issue.parentIssueId);
    }
  }

  return [...childParentIds];
}
