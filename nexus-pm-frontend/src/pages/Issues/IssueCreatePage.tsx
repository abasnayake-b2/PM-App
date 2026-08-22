import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bug } from 'lucide-react';
import { IssueForm } from '@/components/IssueForm';
import { fetchProjects } from '@/api/projects.api';
import { fetchPriorities, fetchIssueTypes } from '@/api/lookup.api';
import { fetchIssue } from '@/api/issues.api';
import { useCreateIssue } from '@/hooks/useIssues';
import { usePermissions } from '@/hooks/usePermissions';
import { P } from '@/utils/permissions';
import {
  EMPTY_CREATE_CHILD_ROWS,
  persistIssueChildRows,
} from '@/utils/issueCreateChildren';

export function IssueCreatePage() {
  const { can } = usePermissions();
  const [searchParams] = useSearchParams();
  const parentId = searchParams.get('parentId') ?? undefined;
  const initialProjectId = searchParams.get('projectId') ?? undefined;
  const initialChildWorkflowCode = searchParams.get('childType') ?? undefined;
  const createIssue = useCreateIssue({ redirectTo: false });
  const navigate = useNavigate();

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

      {createIssue.isError && (
        <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Could not create item. Try again.
        </p>
      )}

      <div className="mt-8 max-w-5xl">
        <IssueForm
          projects={projectsData?.content?.map((p) => ({ id: p.id, label: p.name })) ?? []}
          priorities={priorities ?? []}
          issueTypes={issueTypes ?? []}
          initialProjectId={initialProjectId}
          parentIssue={parentFormProps}
          initialChildWorkflowCode={initialChildWorkflowCode}
          variant="panel"
          loading={createIssue.isPending}
          onCancel={() => window.history.back()}
          onSubmit={async (payload, extras) => {
            try {
              const issue = await createIssue.mutateAsync(payload);
              const childRows = extras ?? EMPTY_CREATE_CHILD_ROWS;
              try {
                if (
                  childRows.notes.length > 0 ||
                  childRows.risks.length > 0 ||
                  childRows.quarterlyCompletions.length > 0
                ) {
                  await persistIssueChildRows(issue.id, childRows);
                }
              } catch {
                /* RD is created; child rows can be added on the edit page */
              }
              navigate(`/issues/${issue.id}`);
            } catch {
              /* error shown by mutation */
            }
          }}
        />
      </div>
    </div>
  );
}
