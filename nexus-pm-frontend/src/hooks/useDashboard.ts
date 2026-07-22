import { useQuery } from '@tanstack/react-query';
import {
  fetchDashboardOverview,
  fetchCapacityUtilisationDashboard,
} from '@/api/notifications.api';
import { fetchCrStatusMatrix } from '@/api/crMatrix.api';

const REFRESH_MS = 30_000;

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardOverview,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useCapacityUtilisationDashboard(enabled = true, weeks = 12) {
  return useQuery({
    queryKey: ['dashboard-capacity-utilisation', weeks],
    queryFn: () => fetchCapacityUtilisationDashboard(weeks),
    enabled,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}

export function useCrStatusMatrixDashboard(enabled = true) {
  return useQuery({
    queryKey: ['dashboard-cr-status-matrix'],
    queryFn: () => fetchCrStatusMatrix(),
    enabled,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });
}
