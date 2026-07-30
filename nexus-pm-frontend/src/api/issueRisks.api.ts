import api from '@/api/axios';

export interface IssueRisk {
  id: string;
  issueId: string;
  riskNumber: number;
  displayKey: string;
  description?: string;
  createdDate?: string;
  owner?: string;
  status?: string;
  impact?: string;
  closedDate?: string;
  mitigation?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueRiskPayload {
  description?: string;
  createdDate?: string | null;
  owner?: string | null;
  status?: string | null;
  impact?: string | null;
  closedDate?: string | null;
  mitigation?: string | null;
  clearCreatedDate?: boolean;
  clearOwner?: boolean;
  clearStatus?: boolean;
  clearImpact?: boolean;
  clearClosedDate?: boolean;
  clearMitigation?: boolean;
}

export const RISK_STATUS_OPTIONS = ['Open', 'Closed', 'Hold', 'Rejected'] as const;
export const RISK_IMPACT_OPTIONS = ['Low', 'Mid', 'High'] as const;

export async function fetchIssueRisks(issueId: string): Promise<IssueRisk[]> {
  const { data } = await api.get<IssueRisk[]>(`/issues/${issueId}/risks`);
  return data;
}

export async function createIssueRisk(issueId: string, payload: IssueRiskPayload): Promise<IssueRisk> {
  const { data } = await api.post<IssueRisk>(`/issues/${issueId}/risks`, payload);
  return data;
}

export async function updateIssueRisk(id: string, payload: IssueRiskPayload): Promise<IssueRisk> {
  const { data } = await api.put<IssueRisk>(`/issue-risks/${id}`, payload);
  return data;
}

export async function deleteIssueRisk(id: string): Promise<void> {
  await api.delete(`/issue-risks/${id}`);
}
