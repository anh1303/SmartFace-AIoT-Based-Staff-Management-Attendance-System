import { useQuery } from '@tanstack/react-query';
import { fetchMonthlyReportApi, type MonthlyReportData } from '../api/reportsApi';

export const MONTHLY_REPORT_QUERY_KEY = ['reports', 'monthly'];

export function useMonthlyReport(period?: string) {
  const query = useQuery<MonthlyReportData, Error>({
    queryKey: [...MONTHLY_REPORT_QUERY_KEY, period || 'current'],
    queryFn: () => fetchMonthlyReportApi(period),
    staleTime: 1000 * 60 * 3, // 3 phút
    retry: 1,
  });

  return {
    reportData: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
