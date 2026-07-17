import {
  Bug,
  CheckSquare,
  Bookmark,
  Lightbulb,
  Gem,
  GitBranch,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react';

export interface IssueTypeVisual {
  icon: LucideIcon;
  color: string;
  label: string;
}

const WORKFLOW_VISUALS: Record<string, IssueTypeVisual> = {
  BUG: { icon: Bug, color: '#E24B4A', label: 'Bugs' },
  TASK: { icon: CheckSquare, color: '#2563EB', label: 'Task' },
  STORY: { icon: Bookmark, color: '#16A34A', label: 'Stories' },
  FEATURE: { icon: Bookmark, color: '#16A34A', label: 'Stories' },
  CHANGE: { icon: Lightbulb, color: '#D97706', label: 'Change Request' },
  EPIC: { icon: Gem, color: '#7C3AED', label: 'Epic' },
  SUBTASK: { icon: GitBranch, color: '#3B82F6', label: 'Sub-task' },
  IMPROVE: { icon: Bookmark, color: '#9333EA', label: 'Improvement' },
};

const NAME_VISUALS: Record<string, IssueTypeVisual> = {
  bug: WORKFLOW_VISUALS.BUG,
  bugs: WORKFLOW_VISUALS.BUG,
  task: WORKFLOW_VISUALS.TASK,
  story: WORKFLOW_VISUALS.STORY,
  stories: WORKFLOW_VISUALS.STORY,
  feature: WORKFLOW_VISUALS.FEATURE,
  'change request': WORKFLOW_VISUALS.CHANGE,
  cr: WORKFLOW_VISUALS.CHANGE,
  epic: WORKFLOW_VISUALS.EPIC,
  'sub-task': WORKFLOW_VISUALS.SUBTASK,
  subtask: WORKFLOW_VISUALS.SUBTASK,
  improvement: WORKFLOW_VISUALS.IMPROVE,
};

const FALLBACK_VISUAL: IssueTypeVisual = {
  icon: CircleHelp,
  color: '#5A5F7A',
  label: 'Issue',
};

export function resolveIssueTypeVisual(
  name?: string | null,
  workflowCode?: string | null,
): IssueTypeVisual {
  const code = workflowCode?.trim().toUpperCase();
  if (code && WORKFLOW_VISUALS[code]) {
    return { ...WORKFLOW_VISUALS[code], label: name?.trim() || WORKFLOW_VISUALS[code].label };
  }

  const normalizedName = name?.trim().toLowerCase();
  if (normalizedName && NAME_VISUALS[normalizedName]) {
    return { ...NAME_VISUALS[normalizedName], label: name!.trim() };
  }

  return {
    ...FALLBACK_VISUAL,
    label: name?.trim() || FALLBACK_VISUAL.label,
  };
}
