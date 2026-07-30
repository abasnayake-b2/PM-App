import api from '@/api/axios';

export interface RiskRecord {
  id: string;
  parentId?: string;
  /** Issue API uses issueId; normalize in callers if needed. */
  issueId?: string;
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

export interface RiskPayload {
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

export async function fetchProjectRisks(projectId: string): Promise<RiskRecord[]> {
  const { data } = await api.get<RiskRecord[]>(`/projects/${projectId}/risks`);
  return data;
}

export async function createProjectRisk(projectId: string, payload: RiskPayload): Promise<RiskRecord> {
  const { data } = await api.post<RiskRecord>(`/projects/${projectId}/risks`, payload);
  return data;
}

export async function updateProjectRisk(id: string, payload: RiskPayload): Promise<RiskRecord> {
  const { data } = await api.put<RiskRecord>(`/project-risks/${id}`, payload);
  return data;
}

export async function deleteProjectRisk(id: string): Promise<void> {
  await api.delete(`/project-risks/${id}`);
}

export async function fetchReleaseRisks(releaseId: string): Promise<RiskRecord[]> {
  const { data } = await api.get<RiskRecord[]>(`/releases/${releaseId}/risks`);
  return data;
}

export async function createReleaseRisk(releaseId: string, payload: RiskPayload): Promise<RiskRecord> {
  const { data } = await api.post<RiskRecord>(`/releases/${releaseId}/risks`, payload);
  return data;
}

export async function updateReleaseRisk(id: string, payload: RiskPayload): Promise<RiskRecord> {
  const { data } = await api.put<RiskRecord>(`/release-risks/${id}`, payload);
  return data;
}

export async function deleteReleaseRisk(id: string): Promise<void> {
  await api.delete(`/release-risks/${id}`);
}
