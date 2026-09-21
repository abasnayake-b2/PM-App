import api from '@/api/axios';

export interface TaskRecord {
  id: string;
  issueId?: string;
  projectId?: string;
  taskNumber: number;
  displayKey: string;
  description: string;
  module?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskPayload {
  description: string;
  module?: string | null;
  clearModule?: boolean;
}

export async function fetchIssueTasks(issueId: string): Promise<TaskRecord[]> {
  const { data } = await api.get<TaskRecord[]>(`/issues/${issueId}/tasks`);
  return data;
}

export async function createIssueTask(issueId: string, payload: TaskPayload): Promise<TaskRecord> {
  const { data } = await api.post<TaskRecord>(`/issues/${issueId}/tasks`, payload);
  return data;
}

export async function updateIssueTask(id: string, payload: TaskPayload): Promise<TaskRecord> {
  const { data } = await api.put<TaskRecord>(`/issue-tasks/${id}`, payload);
  return data;
}

export async function deleteIssueTask(id: string): Promise<void> {
  await api.delete(`/issue-tasks/${id}`);
}

export async function fetchProjectTasks(projectId: string): Promise<TaskRecord[]> {
  const { data } = await api.get<TaskRecord[]>(`/projects/${projectId}/tasks`);
  return data;
}

export async function createProjectTask(projectId: string, payload: TaskPayload): Promise<TaskRecord> {
  const { data } = await api.post<TaskRecord>(`/projects/${projectId}/tasks`, payload);
  return data;
}

export async function updateProjectTask(id: string, payload: TaskPayload): Promise<TaskRecord> {
  const { data } = await api.put<TaskRecord>(`/project-tasks/${id}`, payload);
  return data;
}

export async function deleteProjectTask(id: string): Promise<void> {
  await api.delete(`/project-tasks/${id}`);
}
