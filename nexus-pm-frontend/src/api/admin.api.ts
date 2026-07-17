import api from './axios';
import type {
  AuditLogEntry,
  Holiday,
  WorkflowRule,
  SystemSetting,
  NotificationTemplate,
  PageResponse,
} from '@/types';

export async function fetchAuditLogs(
  page = 0,
  search = '',
  size = 25,
): Promise<PageResponse<AuditLogEntry>> {
  const { data } = await api.get<PageResponse<AuditLogEntry>>('/admin/audit-logs', {
    params: {
      page,
      size,
      sort: 'createdAt,desc',
      search: search || undefined,
    },
  });
  return data;
}

export async function fetchHolidays(): Promise<Holiday[]> {
  const { data } = await api.get<Holiday[]>('/admin/holidays');
  return data;
}

export async function createHoliday(payload: {
  name: string;
  holidayDate: string;
  countryId?: string;
}): Promise<Holiday> {
  const { data } = await api.post<Holiday>('/admin/holidays', payload);
  return data;
}

export async function deleteHoliday(id: string): Promise<void> {
  await api.delete(`/admin/holidays/${id}`);
}

export async function fetchWorkflowRules(): Promise<WorkflowRule[]> {
  const { data } = await api.get<WorkflowRule[]>('/admin/workflow-rules');
  return data;
}

export async function fetchSystemSettings(): Promise<SystemSetting[]> {
  const { data } = await api.get<SystemSetting[]>('/admin/settings');
  return data;
}

export async function updateSystemSetting(id: string, settingValue: string): Promise<SystemSetting> {
  const { data } = await api.put<SystemSetting>(`/admin/settings/${id}`, { settingValue });
  return data;
}

export async function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  const { data } = await api.get<NotificationTemplate[]>('/admin/notification-templates');
  return data;
}
