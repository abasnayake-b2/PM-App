import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createIssueRisk,
  deleteIssueRisk,
  fetchIssueRisks,
  updateIssueRisk,
  type IssueRiskPayload,
} from '@/api/issueRisks.api';

export function useIssueRisks(issueId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['issue-risks', issueId],
    queryFn: () => fetchIssueRisks(issueId!),
    enabled: !!issueId && enabled,
  });
}

export function useCreateIssueRisk(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueRiskPayload) => createIssueRisk(issueId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-risks', issueId] });
    },
  });
}

export function useUpdateIssueRisk(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IssueRiskPayload }) =>
      updateIssueRisk(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-risks', issueId] });
    },
  });
}

export function useDeleteIssueRisk(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIssueRisk(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-risks', issueId] });
    },
  });
}
