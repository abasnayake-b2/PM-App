import clsx from 'clsx';
import { resolveIssueTypeVisual } from '@/utils/issueTypeUi';

interface IssueTypeIconProps {
  name?: string | null;
  workflowCode?: string | null;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

export function IssueTypeIcon({
  name,
  workflowCode,
  size = 16,
  className,
  showLabel = false,
}: IssueTypeIconProps) {
  const visual = resolveIssueTypeVisual(name, workflowCode);
  const Icon = visual.icon;

  return (
    <span className={clsx('inline-flex items-center gap-1.5', className)} title={visual.label}>
      <Icon size={size} style={{ color: visual.color }} aria-hidden />
      {showLabel && <span className="text-sm text-text">{visual.label}</span>}
    </span>
  );
}
