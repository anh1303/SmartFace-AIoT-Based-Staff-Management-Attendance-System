import { useQuery } from '@tanstack/react-query';
import { fetchTodayDashboardApi, type TodayDashboardData } from '../api/dashboardApi';

export const TODAY_DASHBOARD_QUERY_KEY = ['dashboard', 'today'];

export function useDashboardToday() {
  const query = useQuery<TodayDashboardData, Error>({
    queryKey: TODAY_DASHBOARD_QUERY_KEY,
    queryFn: fetchTodayDashboardApi,
    staleTime: 1000 * 15, // 15s
    refetchInterval: 1000 * 30, // Tự động làm mới mỗi 30s
    retry: 1,
  });

  return {
    dashboardData: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
