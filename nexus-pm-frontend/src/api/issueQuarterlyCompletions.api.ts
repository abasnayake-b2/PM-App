import api from '@/api/axios';

export interface IssueQuarterlyCompletion {
  id: string;
  issueId: string;
  year: number;
  quarter: number;
  displayKey: string;
  percentage: number | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueQuarterlyCompletionPayload {
  year: number;
  quarter: number;
  percentage: number;
}

export const QUARTER_OPTIONS = [1, 2, 3, 4] as const;

export function quarterLabel(quarter: number): string {
  return `Q${quarter}`;
}

export async function fetchIssueQuarterlyCompletions(
  issueId: string,
): Promise<IssueQuarterlyCompletion[]> {
  const { data } = await api.get<IssueQuarterlyCompletion[]>(
    `/issues/${issueId}/quarterly-completions`,
  );
  return data;
}

export async function createIssueQuarterlyCompletion(
  issueId: string,
  payload: IssueQuarterlyCompletionPayload,
): Promise<IssueQuarterlyCompletion> {
  const { data } = await api.post<IssueQuarterlyCompletion>(
    `/issues/${issueId}/quarterly-completions`,
    payload,
  );
  return data;
}

export async function updateIssueQuarterlyCompletion(
  id: string,
  payload: IssueQuarterlyCompletionPayload,
): Promise<IssueQuarterlyCompletion> {
  const { data } = await api.put<IssueQuarterlyCompletion>(
    `/quarterly-completions/${id}`,
    payload,
  );
  return data;
}

export async function deleteIssueQuarterlyCompletion(id: string): Promise<void> {
  await api.delete(`/quarterly-completions/${id}`);
}
