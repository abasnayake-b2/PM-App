import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bug } from 'lucide-react';
import { IssueForm } from '@/components/IssueForm';
import { fetchProjects } from '@/api/projects.api';
import { fetchPriorities, fetchIssueTypes } from '@/api/lookup.api';
import { fetchIssue } from '@/api/issues.api';
import { useCreateIssue } from '@/hooks/useIssues';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';

export function IssueCreatePage() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parentId') ?? undefined;
  const initialProjectId = searchParams.get('projectId') ?? undefined;
  const initialChildWorkflowCode = searchParams.get('childType') ?? undefined;
  const createIssue = useCreateIssue();

  const { data: parentIssue } = useQuery({
    queryKey: ['issue', parentId],
    queryFn: () => fetchIssue(parentId!),
    enabled: !!parentId,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-issues'],
    queryFn: () => fetchProjects({ size: 100 }),
  });
  const { data: priorities } = useQuery({ queryKey: ['priorities'], queryFn: fetchPriorities });
  const { data: issueTypes } = useQuery({ queryKey: ['issue-types'], queryFn: fetchIssueTypes });

  const parentFormProps = parentIssue
    ? {
        id: parentIssue.id,
        title: parentIssue.title,
        workflowCode: parentIssue.issueTypeWorkflowCode ?? '',
        projectId: parentIssue.projectId,
      }
    : undefined;

  if (!can(P.ISSUES_CREATE)) {
    return <Navigate to="/issues" replace />;
  }

  return (
    <div>
      <Link
        to={parentIssue ? `/issues/${parentIssue.id}` : '/issues'}
        className="text-sm text-accent hover:underline"
      >
        {parentIssue ? '← Back to parent item' : '← Back to backlog'}
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <Bug className="text-accent" size={28} />
        <div>
          <h1 className="text-2xl font-bold">{parentIssue ? 'New child item' : 'New Item'}</h1>
          <p className="text-text2">
            {parentIssue
              ? 'Add a child item under the selected parent'
              : 'Log a bug, feature, or change request'}
          </p>
        </div>
      </div>

      <div className="mt-8 max-w-2xl">
        <IssueForm
          projects={projectsData?.content?.map((p) => ({ id: p.id, label: p.name })) ?? []}
          priorities={priorities ?? []}
          issueTypes={issueTypes ?? []}
          initialProjectId={initialProjectId}
          parentIssue={parentFormProps}
          initialChildWorkflowCode={initialChildWorkflowCode}
          loading={createIssue.isPending}
          onCancel={() => window.history.back()}
          onSubmit={(payload) => createIssue.mutate(payload)}
        />
      </div>
    </div>
  );
}
