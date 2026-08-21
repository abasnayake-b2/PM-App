import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createIssueQuarterlyCompletion,
  deleteIssueQuarterlyCompletion,
  fetchIssueQuarterlyCompletions,
  updateIssueQuarterlyCompletion,
  type IssueQuarterlyCompletionPayload,
} from '@/api/issueQuarterlyCompletions.api';

export function useIssueQuarterlyCompletions(issueId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['issue-quarterly-completions', issueId],
    queryFn: () => fetchIssueQuarterlyCompletions(issueId!),
    enabled: !!issueId && enabled,
  });
}

export function useCreateIssueQuarterlyCompletion(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueQuarterlyCompletionPayload) =>
      createIssueQuarterlyCompletion(issueId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-quarterly-completions', issueId] });
    },
  });
}

export function useUpdateIssueQuarterlyCompletion(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IssueQuarterlyCompletionPayload }) =>
      updateIssueQuarterlyCompletion(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-quarterly-completions', issueId] });
    },
  });
}

export function useDeleteIssueQuarterlyCompletion(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIssueQuarterlyCompletion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-quarterly-completions', issueId] });
    },
  });
}
