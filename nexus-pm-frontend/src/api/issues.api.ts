import api from './axios';
import type { Issue, PageResponse } from '@/types';

export interface IssueListParams {
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
  /** Spring Data sort, e.g. `rdNumber,asc` */
  sort?: string | string[];
}

export async function fetchIssues(params: IssueListParams = {}): Promise<PageResponse<Issue>> {
  const { statusIds, ...rest } = params;
  const { data } = await api.get<PageResponse<Issue>>('/issues', {
    params: {
      ...rest,
      ...(statusIds?.length ? { statusIds } : {}),
    },
    paramsSerializer: {
      indexes: null,
    },
  });
  return data;
}

export interface IssueStatusCounts {
  /** statusId → total across the full filtered set (not the current page) */
  countsByStatusId: Record<string, number>;
  total: number;
}

export async function fetchIssueStatusCounts(params: {
  projectId?: string;
  unreleasedOnly?: boolean;
  priorityId?: string;
  issueTypeId?: string;
} = {}): Promise<IssueStatusCounts> {
  const { data } = await api.get<IssueStatusCounts>('/issues/status-counts', { params });
  // Backend may serialize UUID keys; normalize to string keys + number values
  const raw = data?.countsByStatusId ?? {};
  const countsByStatusId: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    countsByStatusId[key] = Number(value) || 0;
  }
  return {
    countsByStatusId,
    total: Number(data?.total) || 0,
  };
}

export async function fetchIssue(id: string): Promise<Issue> {
  const { data } = await api.get<Issue>(`/issues/${id}`);
  return data;
}

export async function fetchIssueChildren(parentId: string): Promise<Issue[]> {
  const { data } = await api.get<Issue[]>(`/issues/${parentId}/children`);
  return data;
}

export interface CreateIssuePayload {
  projectId: string;
  releaseId?: string;
  parentIssueId?: string;
  title: string;
  description?: string;
  issueTypeId: string;
  priorityId: string;
  assignedToId?: string;
  originalEstimation?: number;
  actualEstimation?: number;
  capitalizable?: boolean;
  component?: string;
  customFields?: Record<string, string>;
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  priorityId?: string;
  assignedToId?: string;
  clearAssignedTo?: boolean;
  releaseId?: string;
  clearRelease?: boolean;
  originalEstimation?: number;
  actualEstimation?: number;
  capitalizable?: boolean;
  component?: string;
  clearOriginalEstimation?: boolean;
  clearActualEstimation?: boolean;
  clearComponent?: boolean;
  customFields?: Record<string, string>;
}

export async function createIssue(payload: CreateIssuePayload): Promise<Issue> {
  const { data } = await api.post<Issue>('/issues', payload);
  return data;
}

export async function updateIssue(id: string, payload: UpdateIssuePayload): Promise<Issue> {
  const { data } = await api.put<Issue>(`/issues/${id}`, payload);
  return data;
}

export async function transitionIssue(id: string, statusId: string): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}/status`, { statusId });
  return data;
}

export async function deleteIssue(id: string): Promise<void> {
  await api.delete(`/issues/${id}`);
}

export async function restoreIssue(id: string): Promise<Issue> {
  const { data } = await api.patch<Issue>(`/issues/${id}/restore`);
  return data;
}

export interface IssueImportResult {
  fileName: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  importedByName?: string;
  importedAt?: string;
}

export async function importProjectBacklog(projectId: string, file: File): Promise<IssueImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<IssueImportResult>(`/projects/${projectId}/issues/import`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function importBacklogAllProjects(file: File): Promise<IssueImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<IssueImportResult>('/issues/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function exportBacklogExcel(params: {
  projectId?: string;
  statusId?: string;
  statusIds?: string[];
  priorityId?: string;
  issueTypeId?: string;
  q?: string;
} = {}): Promise<void> {
  const { statusIds, ...rest } = params;
  const response = await api.get<Blob>('/issues/export', {
    params: {
      ...rest,
      ...(statusIds?.length ? { statusIds } : {}),
    },
    paramsSerializer: {
      indexes: null,
    },
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ?? `backlog-rds-by-project.xlsx`;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
