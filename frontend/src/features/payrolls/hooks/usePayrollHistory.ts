import { useQuery } from '@tanstack/react-query';
import { fetchPayrollApi } from '../api/payrollApi';

export function usePayrollHistory(employeeId?: string) {
  return useQuery({
    queryKey: ['payroll', 'history', employeeId],
    enabled: Boolean(employeeId),
    queryFn: () => fetchPayrollApi(undefined, employeeId),
    staleTime: 5 * 60 * 1000,
  });
}
