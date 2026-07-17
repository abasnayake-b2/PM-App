import { useQuery } from '@tanstack/react-query';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { IssueForm } from '@/components/IssueForm';
import { fetchPriorities, fetchIssueTypes } from '@/api/lookup.api';
import { useCreateIssue, type CreateIssuePayload } from '@/hooks/useIssues';

interface IssueCreateSlideOverPanelProps {
  projectId: string;
  projectLabel?: string;
  onClose: () => void;
  /** Called after a successful create (before closing); open the new item slide-over. */
  onCreated?: (issueId: string) => void;
}

/**
 * Right-side panel to create a backlog RD / item without leaving the project page.
 */
export function IssueCreateSlideOverPanel({
  projectId,
  projectLabel,
  onClose,
  onCreated,
}: IssueCreateSlideOverPanelProps) {
  const createIssue = useCreateIssue({ redirectTo: false });
  const { data: priorities } = useQuery({ queryKey: ['priorities'], queryFn: fetchPriorities });
  const { data: issueTypes } = useQuery({ queryKey: ['issue-types'], queryFn: fetchIssueTypes });

  const handleSubmit = (payload: CreateIssuePayload) => {
    createIssue.mutate(
      { ...payload, projectId },
      {
        onSuccess: (issue) => {
          onCreated?.(issue.id);
          onClose();
        },
      },
    );
  };

  return (
    <SlideOverPanel
      title="New item"
      subtitle={projectLabel ? `Add to ${projectLabel}` : 'Add to project backlog'}
      size="third"
      accent
      onClose={onClose}
    >
      {createIssue.isError && (
        <p className="mb-4 text-sm text-danger">Could not create item. Try again.</p>
      )}
      <IssueForm
        projects={[{ id: projectId, label: projectLabel ?? 'This project' }]}
        priorities={priorities ?? []}
        issueTypes={issueTypes ?? []}
        initialProjectId={projectId}
        lockProject
        variant="panel"
        loading={createIssue.isPending}
        onCancel={onClose}
        onSubmit={handleSubmit}
      />
    </SlideOverPanel>
  );
}
