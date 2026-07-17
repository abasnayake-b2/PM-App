import api from './axios';
import type { Allocation, Capacity, TaskSummary, TimeLog, WeeklyTimeSummary } from '@/types';

export type AllocationQueryParams = {
  projectId?: string;
  issueId?: string;
  employeeId?: string;
  asOf?: string;
  from?: string;
  to?: string;
};

function allocationQueryParams(params: AllocationQueryParams): Record<string, string> {
  const clean: Record<string, string> = {};
  if (params.projectId) clean.projectId = params.projectId;
  if (params.issueId) clean.issueId = params.issueId;
  if (params.employeeId) clean.employeeId = params.employeeId;
  if (params.asOf) clean.asOf = params.asOf;
  if (params.from) clean.from = params.from;
  if (params.to) clean.to = params.to;
  return clean;
}

export async function fetchAllocations(params: AllocationQueryParams = {}): Promise<Allocation[]> {
  const { data } = await api.get<Allocation[]>('/allocations', {
    params: allocationQueryParams(params),
  });
  return data;
}

export interface CreateAllocationPayload {
  employeeId: string;
  issueId: string;
  roleOnProject?: string;
  percentage: number;
  fromDate: string;
  toDate: string;
  billable?: boolean;
}

export interface OverAllocationError {
  title: string;
  detail: string;
  existingTotal: number;
  totalWouldBe: number;
  breakdown: {
    allocationId: string;
    issueId?: string;
    issueTitle?: string;
    projectId: string;
    projectName: string;
    percentage: number;
    fromDate: string;
    toDate?: string;
  }[];
}

export interface UpdateAllocationPayload {
  roleOnProject?: string;
  percentage: number;
  fromDate: string;
  toDate: string;
  billable?: boolean;
}

export async function createAllocation(payload: CreateAllocationPayload): Promise<Allocation> {
  const { data } = await api.post<Allocation>('/allocations', payload);
  return data;
}

export async function updateAllocation(id: string, payload: UpdateAllocationPayload): Promise<Allocation> {
  const { data } = await api.put<Allocation>(`/allocations/${id}`, payload);
  return data;
}

export async function deleteAllocation(id: string): Promise<void> {
  await api.delete(`/allocations/${id}`);
}

export async function fetchCapacity(params: {
  from?: string;
  to?: string;
  asOf?: string;
  team?: string;
  designationCode?: string;
  engineeringManager?: string;
  name?: string;
} = {}): Promise<Capacity[]> {
  const { data } = await api.get<Capacity[]>('/allocations/capacity', { params });
  return data;
}

export async function exportCapacityTimeline(params: {
  from?: string;
  to?: string;
  asOf?: string;
  team?: string;
  designationCode?: string;
  engineeringManager?: string;
  name?: string;
} = {}): Promise<void> {
  const response = await api.get<Blob>('/allocations/capacity/timeline/export', {
    params,
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  const filename =
    match?.[1] ??
    `resource-utilization-timeline-${params.from ?? 'start'}-to-${params.to ?? 'end'}.xlsx`;

  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export interface RosterAllocationResource {
  employeeId: string;
  fullName: string;
  designationName?: string;
  teamName?: string;
  engineeringManagerName?: string;
}

export async function fetchRosterAllocationResources(): Promise<RosterAllocationResource[]> {
  const { data } = await api.get<RosterAllocationResource[]>('/allocations/roster-resources');
  return data;
}

export async function fetchTimeLogs(params: {
  from?: string;
  to?: string;
} = {}): Promise<TimeLog[]> {
  const { data } = await api.get<TimeLog[]>('/time-logs', { params });
  return data;
}

export async function fetchWeeklySummary(weekStart?: string): Promise<WeeklyTimeSummary> {
  const { data } = await api.get<WeeklyTimeSummary>('/time-logs/weekly-summary', {
    params: weekStart ? { weekStart } : undefined,
  });
  return data;
}

export async function fetchTasks(projectId?: string): Promise<TaskSummary[]> {
  const { data } = await api.get<TaskSummary[]>('/tasks', {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

export async function createTimeLog(payload: {
  taskId: string;
  logDate: string;
  hours: number;
  notes?: string;
}): Promise<TimeLog> {
  const { data } = await api.post<TimeLog>('/time-logs', payload);
  return data;
}
