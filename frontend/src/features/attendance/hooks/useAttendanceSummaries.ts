import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

export interface AttendanceSummary {
  employee_id: string; date: string; total_working_hours: number; late_early: number; overtime: number;
  first_check_in: string | null; last_check_out: string | null; status: string;
  regular_seconds: number; overtime_seconds: number; late_early_seconds: number;
  overtime_candidate_hours: number; overtime_status: string; requires_review: boolean; policy_version?: string | null; review_reason: string | null;
  calculation_details?: { events?: Array<{ id: string; type: string; time: string; status: string }>; pairs?: Array<{ inId: string; outId: string; start: string; end: string }> };
}
export interface SummaryMap {
  customOvertimeMap: Record<string, number>;
  customLateEarlyMap: Record<string, number>;
}

export function useAttendanceSummaries(startDate?: string, endDate?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['attendanceSummaries', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate || startDate) params.set('endDate', endDate || startDate!);
      const res = await apiFetch(`/api/attendance/summaries?${params}`);
      if (!res.success) throw new Error(res.message || 'Không tải được tổng hợp công');
      const summariesByKey: Record<string, AttendanceSummary> = {};
      const otMap: Record<string, number> = {};
      const leMap: Record<string, number> = {};

      if (res.success && Array.isArray(res.data)) {
        res.data.forEach((s: AttendanceSummary) => {
          const key = `${s.employee_id}_${s.date}`;
          summariesByKey[key] = s;
          const otSec = Math.round((Number(s.overtime) || 0) * 3600);
          const leSec = Math.round((Number(s.late_early) || 0) * 3600);
          otMap[key] = otSec;
          leMap[key] = leSec;
        });
      }

      return { customOvertimeMap: otMap, customLateEarlyMap: leMap, summariesByKey };
    },
    staleTime: 1000 * 60 * 2,
  });

  const adjustMutation = useMutation({
    mutationFn: async (payload: {
      employeeId: string;
      date: string;
      late_early: number;
      overtime: number;
      reason: string;
    }) => {
      const res = await apiFetch('/api/attendance/adjust', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.success) {
        throw new Error(res.message || 'Lỗi điều chỉnh dữ liệu chấm công');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: Error) => {
      showToast(err.message || 'Không thể kết nối đến máy chủ để lưu thay đổi!', 'error');
    },
  });

  return {
    summariesByKey: query.data?.summariesByKey || {},
    customOvertimeMap: query.data?.customOvertimeMap || {},
    customLateEarlyMap: query.data?.customLateEarlyMap || {},
    isLoading: query.isLoading,
    adjustAttendance: adjustMutation.mutateAsync,
  };
}
