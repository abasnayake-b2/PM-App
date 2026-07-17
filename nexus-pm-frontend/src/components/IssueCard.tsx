import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { StatusPill } from '@/components/StatusPill';
import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import type { Issue } from '@/types';
import { issueAssigneeName } from '@/utils/issueUi';

interface IssueCardProps {
  issue: Issue;
  canDelete?: boolean;
  deleting?: boolean;
  onDelete?: (issue: Issue) => void;
  onClick?: (issue: Issue) => void;
}

export function IssueCard({
  issue,
  canDelete = false,
  deleting = false,
  onDelete,
  onClick,
}: IssueCardProps) {
  return (
    <div className="relative rounded-xl border border-border bg-bg2 p-5 transition hover:border-accent/50">
      {canDelete && onDelete && (
        <button
          type="button"
          onClick={() => onDelete(issue)}
          disabled={deleting}
          className="absolute right-3 top-3 z-10 rounded p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
          title="Delete item"
          aria-label={`Delete ${issue.title}`}
        >
          <Trash2 size={16} />
        </button>
      )}
      {onClick ? (
        <button type="button" onClick={() => onClick(issue)} className="block w-full text-left">
          <IssueCardBody issue={issue} />
        </button>
      ) : (
        <Link to={`/issues/${issue.id}`} className="block">
          <IssueCardBody issue={issue} />
        </Link>
      )}
    </div>
  );
}

function IssueCardBody({ issue }: { issue: Issue }) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{issue.title}</h3>
          <p className="mt-1 text-sm text-text2">
            {issue.projectName} · {issue.releaseName}
          </p>
        </div>
        <StatusPill label={issue.statusName} colour={issue.statusColour} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text2">
        <span
          className="rounded px-2 py-0.5 font-medium"
          style={
            issue.priorityColour
              ? { backgroundColor: `${issue.priorityColour}22`, color: issue.priorityColour }
              : undefined
          }
        >
          {issue.priorityLabel}
        </span>
        <span>
          <IssueTypeIcon
            name={issue.issueTypeName}
            workflowCode={issue.issueTypeWorkflowCode}
            size={14}
            showLabel
          />
        </span>
        {issueAssigneeName(issue) && <span>→ {issueAssigneeName(issue)}</span>}
      </div>
    </>
  );
}
