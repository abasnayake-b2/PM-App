import api from '@/api/axios';

export interface IssueNote {
  id: string;
  issueId: string;
  date: string;
  note: string;
  owner: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueNotePayload {
  date?: string;
  note: string;
}

export async function fetchIssueNotes(issueId: string): Promise<IssueNote[]> {
  const { data } = await api.get<IssueNote[]>(`/issues/${issueId}/notes`);
  return data;
}

export async function createIssueNote(
  issueId: string,
  payload: IssueNotePayload,
): Promise<IssueNote> {
  const { data } = await api.post<IssueNote>(`/issues/${issueId}/notes`, payload);
  return data;
}

export async function updateIssueNote(id: string, payload: IssueNotePayload): Promise<IssueNote> {
  const { data } = await api.put<IssueNote>(`/issue-notes/${id}`, payload);
  return data;
}

export async function deleteIssueNote(id: string): Promise<void> {
  await api.delete(`/issue-notes/${id}`);
}
