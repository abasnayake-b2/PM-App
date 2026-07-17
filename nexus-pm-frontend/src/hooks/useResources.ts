import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAllocations,
  fetchCapacity,
  fetchTimeLogs,
  fetchWeeklySummary,
  fetchTasks,
  createTimeLog,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  type AllocationQueryParams,
  type CreateAllocationPayload,
  type UpdateAllocationPayload,
} from '@/api/resources.api';

export type { CreateAllocationPayload, UpdateAllocationPayload };

export function useCapacity(
  params: {
    from?: string;
    to?: string;
    asOf?: string;
    team?: string;
    designationCode?: string;
    engineeringManager?: string;
    name?: string;
  } = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: ['capacity', params],
    queryFn: () => fetchCapacity(params),
    enabled: options.enabled !== false,
  });
}

export function useAllocations(params: AllocationQueryParams = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [
      'allocations',
      params.issueId ?? null,
      params.projectId ?? null,
      params.employeeId ?? null,
      params.asOf ?? null,
      params.from ?? null,
      params.to ?? null,
    ],
    queryFn: () => fetchAllocations(params),
    enabled: options.enabled !== false,
  });
}

function invalidateAllocationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  projectId?: string,
) {
  queryClient.invalidateQueries({ queryKey: ['allocations'] });
  queryClient.invalidateQueries({ queryKey: ['capacity'] });
  queryClient.invalidateQueries({ queryKey: ['issues'] });
  queryClient.invalidateQueries({ queryKey: ['issue'] });
  if (projectId) {
    queryClient.invalidateQueries({ queryKey: ['project', projectId] });
  }
  queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
}

export function useCreateAllocation(issueId?: string, projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAllocationPayload) => createAllocation(payload),
    onSuccess: () => invalidateAllocationQueries(queryClient, projectId),
  });
}

export function useUpdateAllocation(issueId?: string, projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAllocationPayload }) =>
      updateAllocation(id, payload),
    onSuccess: () => invalidateAllocationQueries(queryClient, projectId),
  });
}

export function useDeleteAllocation(issueId?: string, projectId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAllocation,
    onSuccess: () => invalidateAllocationQueries(queryClient, projectId),
  });
}

export function useTimeLogs(params: { from?: string; to?: string } = {}) {
  return useQuery({
    queryKey: ['time-logs', params],
    queryFn: () => fetchTimeLogs(params),
  });
}

export function useWeeklySummary() {
  return useQuery({
    queryKey: ['weekly-summary'],
    queryFn: () => fetchWeeklySummary(),
  });
}

export function useTasks(projectId?: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => fetchTasks(projectId),
  });
}

export function useCreateTimeLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTimeLog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-logs'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-summary'] });
    },
  });
}
