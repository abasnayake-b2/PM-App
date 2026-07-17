import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchAuditLogs,
  fetchHolidays,
  createHoliday,
  deleteHoliday,
  fetchWorkflowRules,
  fetchSystemSettings,
  updateSystemSetting,
  fetchNotificationTemplates,
} from '@/api/admin.api';

export function useAuditLogs(page = 0, search = '', size = 25) {
  return useQuery({
    queryKey: ['admin-audit', page, search, size],
    queryFn: () => fetchAuditLogs(page, search, size),
  });
}

export function useHolidays() {
  return useQuery({
    queryKey: ['admin-holidays'],
    queryFn: fetchHolidays,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createHoliday,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-holidays'] }),
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteHoliday,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-holidays'] }),
  });
}

export function useWorkflowRules() {
  return useQuery({
    queryKey: ['admin-workflow'],
    queryFn: fetchWorkflowRules,
  });
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ['admin-settings'],
    queryFn: fetchSystemSettings,
  });
}

export function useUpdateSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateSystemSetting(id, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-settings'] }),
  });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: ['admin-templates'],
    queryFn: fetchNotificationTemplates,
  });
}
