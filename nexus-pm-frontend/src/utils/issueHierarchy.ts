import type { IssueType } from '@/api/lookup.api';

const CHILDREN_BY_PARENT: Record<string, string[]> = {
  EPIC: ['STORY', 'TASK', 'BUG', 'CHANGE'],
  STORY: ['TASK', 'BUG'],
};

const TYPE_ORDER = ['EPIC', 'STORY', 'TASK', 'CHANGE', 'BUG'];

export function canHaveChildren(workflowCode?: string | null): boolean {
  if (!workflowCode) return false;
  return workflowCode.trim().toUpperCase() in CHILDREN_BY_PARENT;
}

export function allowedChildWorkflowCodes(parentWorkflowCode?: string | null): string[] {
  if (!parentWorkflowCode) return [];
  const allowed = CHILDREN_BY_PARENT[parentWorkflowCode.trim().toUpperCase()];
  if (!allowed) return [];
  return TYPE_ORDER.filter((code) => allowed.includes(code));
}

export function filterIssueTypesForParent(
  issueTypes: IssueType[],
  parentWorkflowCode?: string | null,
): IssueType[] {
  if (!parentWorkflowCode) return issueTypes;
  const allowed = new Set(allowedChildWorkflowCodes(parentWorkflowCode));
  return issueTypes.filter((type) => allowed.has(type.workflowCode.toUpperCase()));
}

export function childCreateUrl(parentId: string, projectId: string, childWorkflowCode: string): string {
  const params = new URLSearchParams({
    parentId,
    projectId,
    childType: childWorkflowCode,
  });
  return `/issues/new?${params.toString()}`;
}
