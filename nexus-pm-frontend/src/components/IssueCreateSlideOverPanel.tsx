import { useQuery } from '@tanstack/react-query';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { IssueForm, type IssueFormOption } from '@/components/IssueForm';
import { fetchPriorities, fetchIssueTypes } from '@/api/lookup.api';
import { useCreateIssue, type CreateIssuePayload } from '@/hooks/useIssues';

interface IssueCreateSlideOverPanelProps {
  /** When set with lockProject (default), project is fixed. */
  projectId?: string;
  projectLabel?: string;
  /** Available projects when the user can choose (Backlog Tracker). */
  projects?: IssueFormOption[];
  /** Lock to projectId — default true when projectId is provided. */
  lockProject?: boolean;
  onClose: () => void;
  /** Called after a successful create (before closing); open the new item slide-over. */
  onCreated?: (issueId: string) => void;
}

/**
 * Right-side panel to create a backlog RD / item without leaving the page.
 */
export function IssueCreateSlideOverPanel({
  projectId,
  projectLabel,
  projects: projectsProp,
  lockProject: lockProjectProp,
  onClose,
  onCreated,
}: IssueCreateSlideOverPanelProps) {
  const createIssue = useCreateIssue({ redirectTo: false });
  const { data: priorities } = useQuery({ queryKey: ['priorities'], queryFn: fetchPriorities });
  const { data: issueTypes } = useQuery({ queryKey: ['issue-types'], queryFn: fetchIssueTypes });

  const lockProject = lockProjectProp ?? !!projectId;
  const projects: IssueFormOption[] =
    projectsProp && projectsProp.length > 0
      ? projectsProp
      : projectId
        ? [{ id: projectId, label: projectLabel ?? 'This project' }]
        : [];

  const handleSubmit = (payload: CreateIssuePayload) => {
    createIssue.mutate(payload, {
      onSuccess: (issue) => {
        onCreated?.(issue.id);
        onClose();
      },
    });
  };

  const subtitle = lockProject
    ? projectLabel
      ? `Add to ${projectLabel}`
      : 'Add to project backlog'
    : 'Choose a project and add a change request';

  return (
    <SlideOverPanel
      title="New item"
      subtitle={subtitle}
      size="half"
      accent
      onClose={onClose}
    >
      {createIssue.isError && (
        <p className="mb-4 text-sm text-danger">Could not create item. Try again.</p>
      )}
      {projects.length === 0 ? (
        <p className="text-sm text-text2">No projects available. Create a project first.</p>
      ) : (
        <IssueForm
          projects={projects}
          priorities={priorities ?? []}
          issueTypes={issueTypes ?? []}
          initialProjectId={projectId}
          lockProject={lockProject}
          variant="panel"
          loading={createIssue.isPending}
          onCancel={onClose}
          onSubmit={handleSubmit}
        />
      )}
    </SlideOverPanel>
  );
}
