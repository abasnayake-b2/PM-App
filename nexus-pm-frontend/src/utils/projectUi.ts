import type { Project } from '@/types';

export function projectProgressLabel(project: Pick<Project, 'progressPct' | 'progressBasis'>): string {
  const pct = project.progressPct ?? 0;
  switch (project.progressBasis) {
    case 'ISSUES':
      return `${pct}% from completed issues`;
    case 'SCHEDULE':
      return `${pct}% of schedule elapsed`;
    default:
      return `${pct}%`;
  }
}

export function projectProgressHint(project: Pick<Project, 'progressBasis'>): string {
  switch (project.progressBasis) {
    case 'ISSUES':
      return 'Based on issues in Completed, Cancelled, or On Hold status';
    case 'SCHEDULE':
      return 'Based on elapsed time between start and end dates (no issues yet)';
    default:
      return 'Add issues or set project dates to track completion';
  }
}
