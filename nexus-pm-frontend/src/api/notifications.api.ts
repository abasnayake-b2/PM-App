import api from './axios';
import type {
  NotificationItem,
  DashboardSummary,
  DashboardOverview,
  CapacityUtilisationDashboard,
} from '@/types';

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const { data } = await api.get<NotificationItem[]>('/notifications');
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/reports/dashboard');
  return data;
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await api.get<DashboardOverview>('/reports/dashboard/overview');
  return data;
}

export async function fetchCapacityUtilisationDashboard(
  weeks = 12,
): Promise<CapacityUtilisationDashboard> {
  const { data } = await api.get<CapacityUtilisationDashboard>(
    '/reports/dashboard/capacity-utilisation',
    { params: { weeks } },
  );
  return data;
}
