import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { Allocation, Issue } from '@/types';
import { ResourceAvatar } from '@/components/ResourceAvatar';
import { issueDisplayKey } from '@/utils/issueUi';

interface ReleaseIssueTreeProps {
  issues: Issue[];
  allocations: Allocation[];
  canRemove?: boolean;
  removingIssueId?: string | null;
  onRemove?: (issueId: string) => void;
}

export function ReleaseIssueTree({
  issues,
  allocations,
  canRemove = false,
  removingIssueId = null,
  onRemove,
}: ReleaseIssueTreeProps) {
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const allocationsByIssue = useMemo(() => {
    const map = new Map<string, Allocation[]>();
    for (const allocation of allocations) {
      const list = map.get(allocation.issueId) ?? [];
      list.push(allocation);
      map.set(allocation.issueId, list);
    }
    return map;
  }, [allocations]);

  const toggleIssue = (issueId: string) => {
    setExpandedIssues((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  };

  if (issues.length === 0) {
    return <p className="mt-4 text-sm text-text2">No RDs in this release yet.</p>;
  }

  return (
    <ul className="mt-4 space-y-1">
      {issues.map((issue) => {
        const issueAllocations = allocationsByIssue.get(issue.id) ?? [];
        const issueOpen = expandedIssues.has(issue.id);
        const removing = removingIssueId === issue.id;
        return (
          <li key={issue.id} className="rounded-lg border border-border bg-bg3">
            <div className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onClick={() => toggleIssue(issue.id)}
                className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-bg2/50"
              >
                {issueOpen ? (
                  <ChevronDown size={14} className="shrink-0 text-text2" />
                ) : (
                  <ChevronRight size={14} className="shrink-0 text-text2" />
                )}
                <span className="font-mono text-xs text-text2">{issueDisplayKey(issue)}</span>
                <Link
                  to={`/issues/${issue.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="truncate font-medium hover:text-accent"
                >
                  {issue.title}
                </Link>
                <span className="ml-auto shrink-0 text-xs text-text2">{issue.statusName}</span>
              </button>
              {canRemove && onRemove && (
                <button
                  type="button"
                  title="Remove from release"
                  disabled={removing}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove "${issue.title}" from this release? It will return to the backlog.`,
                      )
                    ) {
                      onRemove(issue.id);
                    }
                  }}
                  className="shrink-0 rounded-md p-1.5 text-text2 hover:bg-bg2 hover:text-danger disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {issueOpen && (
              <ul className="border-t border-border px-3 py-2">
                {issueAllocations.length === 0 ? (
                  <li className="py-1 text-xs text-text2">No resources allocated</li>
                ) : (
                  issueAllocations.map((allocation) => (
                    <li
                      key={allocation.id}
                      className="flex items-center justify-between gap-3 py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <ResourceAvatar name={allocation.employeeName} size="sm" />
                        <span>{allocation.employeeName}</span>
                        {allocation.roleOnProject && (
                          <span className="text-xs text-text2">· {allocation.roleOnProject}</span>
                        )}
                      </div>
                      <span className="shrink-0 text-xs font-medium tabular-nums text-text2">
                        {allocation.percentage}%
                      </span>
                    </li>
                  ))
                )}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
