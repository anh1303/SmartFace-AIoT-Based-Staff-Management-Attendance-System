import { useQuery } from '@tanstack/react-query';
import { api } from '../../../api/client';
import type { BackendAttendanceSummaryItem } from './useAttendanceSummaries';

export interface EmployeeOverview {
  period: string;
  through_date: string;
  work_days: number | null;
  working_hours: number | null;
  overtime_hours: number | null;
  late_early_hours: number | null;
  absent_days: number | null;
  today: BackendAttendanceSummaryItem[];
}

export function useEmployeeOverview(employeeId?: string) {
  return useQuery({
    queryKey: ['attendanceSummaries', 'employeeOverview', employeeId], enabled: !!employeeId,
    queryFn: async () => {
      const res = await api.get<EmployeeOverview>(`/api/attendance/employee-overview?employeeId=${encodeURIComponent(employeeId!)}`);
      if (!res.success || !res.data) throw new Error(res.message || 'Không tải được tổng quan chấm công');
      return res.data;
    }, refetchInterval: 60000,
  });
}
