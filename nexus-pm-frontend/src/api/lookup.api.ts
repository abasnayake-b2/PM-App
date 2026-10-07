import api from './axios';

export interface Priority {
  id: string;
  label: string;
  level: number;
  colour: string;
}

export interface IssueType {
  id: string;
  name: string;
  workflowCode: string;
}

export interface TaskType {
  id: string;
  name: string;
  description?: string;
}

export interface TaskCategory {
  id: string;
  name: string;
  description?: string;
}

export interface IssueStatus {
  id: string;
  name: string;
  sequence: number;
  terminal: boolean;
  colour: string;
}

export async function fetchPriorities(): Promise<Priority[]> {
  const { data } = await api.get<Priority[]>('/lookup/priorities');
  return data;
}

export async function fetchIssueTypes(): Promise<IssueType[]> {
  const { data } = await api.get<IssueType[]>('/lookup/issue-types');
  return data;
}

export async function fetchTaskTypes(): Promise<TaskType[]> {
  const { data } = await api.get<TaskType[]>('/lookup/task-types');
  return data;
}

export async function fetchTaskCategories(): Promise<TaskCategory[]> {
  const { data } = await api.get<TaskCategory[]>('/lookup/task-categories');
  return data;
}

export async function fetchIssueStatuses(): Promise<IssueStatus[]> {
  const { data } = await api.get<IssueStatus[]>('/lookup/statuses');
  return data;
}
