import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createIssueTask,
  createProjectTask,
  deleteIssueTask,
  deleteProjectTask,
  fetchIssueTasks,
  fetchProjectTasks,
  updateIssueTask,
  updateProjectTask,
  type TaskPayload,
} from '@/api/scopedTasks.api';

export function useIssueTasks(issueId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['issue-tasks', issueId],
    queryFn: () => fetchIssueTasks(issueId!),
    enabled: !!issueId && enabled,
  });
}

export function useCreateIssueTask(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskPayload) => createIssueTask(issueId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issue-tasks', issueId] }),
  });
}

export function useUpdateIssueTask(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskPayload }) =>
      updateIssueTask(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issue-tasks', issueId] }),
  });
}

export function useDeleteIssueTask(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIssueTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['issue-tasks', issueId] }),
  });
}

export function useProjectTasks(projectId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: () => fetchProjectTasks(projectId!),
    enabled: !!projectId && enabled,
  });
}

export function useCreateProjectTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TaskPayload) => createProjectTask(projectId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
  });
}

export function useUpdateProjectTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: TaskPayload }) =>
      updateProjectTask(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
  });
}

export function useDeleteProjectTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProjectTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-tasks', projectId] }),
  });
}
