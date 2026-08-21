import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createIssueNote,
  deleteIssueNote,
  fetchIssueNotes,
  updateIssueNote,
  type IssueNotePayload,
} from '@/api/issueNotes.api';

export function useIssueNotes(issueId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['issue-notes', issueId],
    queryFn: () => fetchIssueNotes(issueId!),
    enabled: !!issueId && enabled,
  });
}

export function useCreateIssueNote(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: IssueNotePayload) => createIssueNote(issueId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-notes', issueId] });
    },
  });
}

export function useUpdateIssueNote(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: IssueNotePayload }) =>
      updateIssueNote(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-notes', issueId] });
    },
  });
}

export function useDeleteIssueNote(issueId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteIssueNote(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue-notes', issueId] });
    },
  });
}
