import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchIssues, fetchIssue, fetchIssueChildren, createIssue, updateIssue, transitionIssue, deleteIssue, restoreIssue, importProjectBacklog, importBacklogAllProjects, importNewRdExcel, type CreateIssuePayload, type UpdateIssuePayload } from '@/api/issues.api';

export type { CreateIssuePayload, UpdateIssuePayload };

export function useIssues(
  params: {
    projectId?: string;
    releaseId?: string;
    unreleasedOnly?: boolean;
    statusId?: string;
    statusIds?: string[];
    slaStatus?: string;
    assignedToId?: string;
    priorityId?: string;
    issueTypeId?: string;
    q?: string;
    page?: number;
    size?: number;
    sort?: string | string[];
  } = {},
  options: { enabled?: boolean } = {},
) {
  const page = params.page ?? 0;
  const size = params.size ?? 50;
  return useQuery({
    queryKey: ['issues', { ...params, page, size }],
    queryFn: () => fetchIssues({ ...params, page, size }),
    enabled: options.enabled !== false,
    placeholderData: keepPreviousData,
  });
}

export function useIssue(id: string | undefined) {
  return useQuery({
    queryKey: ['issue', id],
    queryFn: () => fetchIssue(id!),
    enabled: !!id,
  });
}

export function useIssueChildren(parentId: string | undefined) {
  return useQuery({
    queryKey: ['issue-children', parentId],
    queryFn: () => fetchIssueChildren(parentId!),
    enabled: !!parentId,
  });
}

export function useCreateIssue(options?: { redirectTo?: string | false }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: createIssue,
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issue-status-counts'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project', issue.projectId] });
      if (issue.parentIssueId) {
        qc.invalidateQueries({ queryKey: ['issue', issue.parentIssueId] });
        qc.invalidateQueries({ queryKey: ['issue-children', issue.parentIssueId] });
      }
      if (options?.redirectTo === false) return;
      navigate(options?.redirectTo ?? `/issues/${issue.id}`);
    },
  });
}

export function useUpdateIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateIssuePayload & { id: string }) => updateIssue(id, payload),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issue-status-counts'] });
      qc.invalidateQueries({ queryKey: ['issue'] });
      qc.invalidateQueries({ queryKey: ['issue-children'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      if (issue.projectId) {
        qc.invalidateQueries({ queryKey: ['project', issue.projectId] });
      }
    },
  });
}

export function useTransitionIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statusId }: { id: string; statusId: string }) => transitionIssue(id, statusId),
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issue-status-counts'] });
      qc.invalidateQueries({ queryKey: ['issue'] });
      qc.invalidateQueries({ queryKey: ['issue-children'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      if (issue.projectId) {
        qc.invalidateQueries({ queryKey: ['project', issue.projectId] });
      }
    },
  });
}

export function useDeleteIssue(options?: { redirectTo?: string | false }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: deleteIssue,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issue-status-counts'] });
      qc.invalidateQueries({ queryKey: ['issue'] });
      qc.invalidateQueries({ queryKey: ['issue-children'] });
      qc.invalidateQueries({ queryKey: ['dashboard-overview'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['project'] });
      qc.invalidateQueries({ queryKey: ['allocations'] });
      if (options?.redirectTo !== false) {
        navigate(options?.redirectTo ?? '/issues');
      }
    },
  });
}

export function useRestoreIssue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: restoreIssue,
    onSuccess: (issue) => {
      qc.invalidateQueries({ queryKey: ['issues'] });
      qc.invalidateQueries({ queryKey: ['issue-status-counts'] });
      qc.invalidateQueries({ queryKey: ['issue', issue.id] });
      qc.invalidateQueries({ queryKey: ['project', issue.projectId] });
    },
  });
}

function invalidateBacklogQueries(qc: ReturnType<typeof useQueryClient>, projectId?: string) {
  qc.invalidateQueries({ queryKey: ['issues'] });
  qc.invalidateQueries({ queryKey: ['issue-status-counts'] });
  qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
  qc.invalidateQueries({ queryKey: ['projects'] });
  if (projectId) {
    qc.invalidateQueries({ queryKey: ['project', projectId] });
    void qc.refetchQueries({ queryKey: ['issues', { projectId, unreleasedOnly: true }] });
    void qc.refetchQueries({ queryKey: ['issues', { projectId }] });
  }
}

export function useImportProjectBacklog(projectId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => importProjectBacklog(projectId!, file),
    onSuccess: () => {
      invalidateBacklogQueries(qc, projectId);
    },
  });
}

export function useImportBacklogAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importBacklogAllProjects,
    onSuccess: () => {
      invalidateBacklogQueries(qc);
    },
  });
}

export function useImportNewRdExcel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: importNewRdExcel,
    onSuccess: () => {
      invalidateBacklogQueries(qc);
    },
  });
}
