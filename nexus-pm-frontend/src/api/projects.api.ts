import api from './axios';
import type { Project, ProjectHealthLog, Release, PageResponse } from '@/types';

export type { PageResponse };

export interface ProjectListParams {
  clientId?: string;
  regionId?: string;
  countryId?: string;
  status?: string;
  ragStatus?: string;
  vpManagementId?: string;
  engineeringManagerManagementId?: string;
  includeArchived?: boolean;
  page?: number;
  size?: number;
}

export interface CreateProjectPayload {
  clientId: string;
  name: string;
  product?: string;
  jiraProjectKey?: string;
  leadEmployeeId: string;
  architectEmployeeId?: string;
  engineeringManagerManagementId?: string;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
}

export interface UpdateProjectPayload {
  name: string;
  product?: string | null;
  jiraProjectKey?: string | null;
  leadEmployeeId?: string;
  architectEmployeeId?: string | null;
  engineeringManagerManagementId?: string | null;
  status?: string;
  startDate?: string;
  endDate?: string;
  budgetAmount?: number;
  budgetCurrency?: string;
}

export async function fetchProjects(params: ProjectListParams = {}): Promise<PageResponse<Project>> {
  const { data } = await api.get<PageResponse<Project>>('/projects', { params });
  return data;
}

export async function fetchProject(id: string): Promise<Project> {
  const { data } = await api.get<Project>(`/projects/${id}`);
  return data;
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await api.post<Project>('/projects', payload);
  return data;
}

export async function updateProject(id: string, payload: UpdateProjectPayload): Promise<Project> {
  const { data } = await api.put<Project>(`/projects/${id}`, payload);
  return data;
}

export async function archiveProject(id: string, archived = true): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}/archive`, null, {
    params: { archived },
  });
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/projects/${id}`);
}

export async function restoreProject(id: string): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}/restore`);
  return data;
}

export async function fetchProjectHealthLog(id: string): Promise<ProjectHealthLog[]> {
  const { data } = await api.get<ProjectHealthLog[]>(`/projects/${id}/health-log`);
  return data;
}

export async function fetchReleases(projectId: string): Promise<Release[]> {
  const { data } = await api.get<Release[]>('/releases', { params: { projectId } });
  return data;
}

export interface CreateReleasePayload {
  projectId: string;
  name: string;
  version?: string;
  status?: string;
  targetDate?: string;
}

export async function createRelease(payload: CreateReleasePayload): Promise<Release> {
  const { data } = await api.post<Release>('/releases', payload);
  return data;
}

export async function deleteRelease(id: string): Promise<void> {
  await api.delete(`/releases/${id}`);
}

export async function updateProjectRag(id: string, ragStatus: string, notes?: string): Promise<Project> {
  const { data } = await api.patch<Project>(`/projects/${id}/rag`, { ragStatus, notes });
  return data;
}

export interface ProjectImportResult {
  fileName: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  importedByName?: string;
  importedAt?: string;
}

export async function importProjects(file: File): Promise<ProjectImportResult> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<ProjectImportResult>('/projects/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export interface JiraSyncResult {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  syncedByName?: string;
  syncedAt?: string;
}

export async function syncProjectFromJira(projectId: string): Promise<JiraSyncResult> {
  const { data } = await api.post<JiraSyncResult>(`/projects/${projectId}/jira/sync`);
  return data;
}
