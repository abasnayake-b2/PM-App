import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { Issue } from '@/types';
import { PriorityBadge } from '@/components/PriorityBadge';
import { StatusPill } from '@/components/StatusPill';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { issueAssigneeName, issueDisplayKey, filterIssuesBySearch } from '@/utils/issueUi';
import { buildIssueTreeRows, collectParentIdsWithChildren } from '@/utils/issueTree';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteIssue } from '@/hooks/useIssues';
import { P } from '@/utils/permissions';

interface IssueTrackerTableProps {
  issues: Issue[];
  hideProject?: boolean;
  /** Live search text — filters the table immediately. */
  searchQuery?: string;
  /** When set, ID/title open this callback instead of navigating to the full issue page. */
  onIssueClick?: (issue: Issue) => void;
  /** Cap height and enable vertical scroll (e.g. ~10 rows under EM matrix). */
  maxHeightClassName?: string;
}

function deleteConfirmMessage(issue: Issue, hasChildren: boolean): string {
  const lines = [
    `Mark "${issue.title}" as deleted?`,
    '',
    'All allocations on this issue will also be marked deleted.',
  ];
  if (hasChildren) {
    lines.push('', 'Child items under this item will remain in the backlog.');
  }
  return lines.join('\n');
}

export function IssueTrackerTable({
  issues,
  hideProject = false,
  searchQuery = '',
  onIssueClick,
  maxHeightClassName,
}: IssueTrackerTableProps) {
  const { can } = usePermissions();
  const canDeleteIssue = can(P.ISSUES_DELETE);
  const deleteIssue = useDeleteIssue({ redirectTo: false });
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());

  const visibleIssues = useMemo(
    () => filterIssuesBySearch(issues, searchQuery),
    [issues, searchQuery],
  );

  const parentIdsWithChildren = useMemo(
    () => collectParentIdsWithChildren(visibleIssues),
    [visibleIssues],
  );
  const treeRows = useMemo(
    () => buildIssueTreeRows(visibleIssues, collapsedIds),
    [visibleIssues, collapsedIds],
  );

  const toggleCollapsed = (issueId: string) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseAll = () => setCollapsedIds(new Set(parentIdsWithChildren));

  const hasHierarchy = parentIdsWithChildren.length > 0;

  const handleDelete = (issue: Issue, hasChildren: boolean) => {
    if (!window.confirm(deleteConfirmMessage(issue, hasChildren))) {
      return;
    }
    setDeletingId(issue.id);
    deleteIssue.mutate(issue.id, {
      onSettled: () => setDeletingId(null),
    });
  };

  return (
    <div className="space-y-2">
      {hasHierarchy && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-lg border border-border px-3 py-1.5 text-text2 hover:bg-bg3 hover:text-text1"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-lg border border-border px-3 py-1.5 text-text2 hover:bg-bg3 hover:text-text1"
          >
            Collapse all
          </button>
        </div>
      )}

      <div
        className={`rounded-xl border border-border ${
          maxHeightClassName
            ? `${maxHeightClassName} overflow-auto`
            : 'overflow-x-auto'
        }`}
      >
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead
            className={`bg-bg2 text-xs font-semibold uppercase tracking-wide text-text2 ${
              maxHeightClassName ? 'sticky top-0 z-10 shadow-sm' : ''
            }`}
          >
            <tr>
              <th className="min-w-[9rem] px-4 py-3">ID</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Title</th>
              {!hideProject && <th className="px-4 py-3">Project</th>}
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Utilization</th>
              <th className="px-4 py-3">Status</th>
              {canDeleteIssue && <th className="w-16 px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {treeRows.map(({ issue, depth, hasChildren, childCount }) => {
              const assignee = issueAssigneeName(issue);
              const isCollapsed = collapsedIds.has(issue.id);

              return (
                <tr key={issue.id} className="border-t border-border hover:bg-bg2/50">
                  <td className="px-4 py-3 font-mono text-xs text-text2">
                    <div
                      className="flex min-w-0 items-center gap-1"
                      style={{ paddingLeft: `${depth * 1.25}rem` }}
                    >
                      {hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggleCollapsed(issue.id)}
                          className="inline-flex shrink-0 rounded p-0.5 text-text2 hover:bg-bg3 hover:text-text1"
                          aria-expanded={!isCollapsed}
                          aria-label={isCollapsed ? `Expand ${issue.title}` : `Collapse ${issue.title}`}
                        >
                          {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                        </button>
                      ) : (
                        <span className="inline-block w-5 shrink-0" aria-hidden />
                      )}
                      {onIssueClick ? (
                        <button
                          type="button"
                          onClick={() => onIssueClick(issue)}
                          className="shrink-0 text-left hover:text-accent"
                        >
                          {issueDisplayKey(issue)}
                        </button>
                      ) : (
                        <Link to={`/issues/${issue.id}`} className="shrink-0 hover:text-accent">
                          {issueDisplayKey(issue)}
                        </Link>
                      )}
                      {hasChildren && isCollapsed && (
                        <span className="shrink-0 rounded-full bg-bg3 px-1.5 py-0.5 text-[10px] font-sans text-text2">
                          {childCount}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge label={issue.priorityLabel ?? '—'} colour={issue.priorityColour} />
                  </td>
                  <td className="px-4 py-3 text-text2">
                    <IssueTypeIcon
                      name={issue.issueTypeName}
                      workflowCode={issue.issueTypeWorkflowCode}
                      size={14}
                      showLabel
                    />
                  </td>
                  <td className="max-w-md px-4 py-3">
                    {onIssueClick ? (
                      <button
                        type="button"
                        onClick={() => onIssueClick(issue)}
                        className="text-left font-medium hover:text-accent"
                      >
                        <span className="line-clamp-2">{issue.title}</span>
                      </button>
                    ) : (
                      <Link to={`/issues/${issue.id}`} className="font-medium hover:text-accent">
                        <span className="line-clamp-2">{issue.title}</span>
                      </Link>
                    )}
                  </td>
                  {!hideProject && (
                    <td className="px-4 py-3 text-text2">{issue.projectName ?? '—'}</td>
                  )}
                  <td className="px-4 py-3">
                    {assignee ? (
                      <div className="flex items-center gap-2">
                        <ResourceAvatar name={assignee.split(',')[0].trim()} size="sm" />
                        <span className="text-text2">{assignee}</span>
                      </div>
                    ) : (
                      <span className="text-text2">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text2">
                    {issue.utilizationPct != null && issue.utilizationPct > 0 ? (
                      <span
                        className={
                          issue.utilizationPct >= 100
                            ? 'font-medium text-danger'
                            : issue.utilizationPct >= 80
                              ? 'font-medium text-warning'
                              : ''
                        }
                      >
                        {issue.utilizationPct}%
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill label={issue.statusName ?? '—'} colour={issue.statusColour} />
                  </td>
                  {canDeleteIssue && (
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(issue, hasChildren)}
                        disabled={deletingId === issue.id}
                        className="rounded p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                        title="Delete item"
                        aria-label={`Delete ${issue.title}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
