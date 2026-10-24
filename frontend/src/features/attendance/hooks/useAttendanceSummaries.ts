import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

export interface SummaryMap {
  customOvertimeMap: Record<string, number>;
  customLateEarlyMap: Record<string, number>;
}

export function useAttendanceSummaries(_selectedDate?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['attendanceSummaries'],
    queryFn: async () => {
      const res = await apiFetch('/api/attendance/summaries');
      const otMap: Record<string, number> = {};
      const leMap: Record<string, number> = {};

      if (res.success && Array.isArray(res.data)) {
        res.data.forEach((s: { employee_id: string; date: string; overtime?: number | string; late_early?: number | string }) => {
          const key = `${s.employee_id}_${s.date}`;
          const otSec = Math.round((Number(s.overtime) || 0) * 3600);
          const leSec = Math.round((Number(s.late_early) || 0) * 3600);
          otMap[key] = otSec;
          leMap[key] = leSec;
        });
      }

      return { customOvertimeMap: otMap, customLateEarlyMap: leMap };
    },
    staleTime: 1000 * 60 * 2,
  });

  const adjustMutation = useMutation({
    mutationFn: async (payload: {
      employeeId: string;
      date: string;
      late_early: number;
      overtime: number;
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
    customOvertimeMap: query.data?.customOvertimeMap || {},
    customLateEarlyMap: query.data?.customLateEarlyMap || {},
    isLoading: query.isLoading,
    adjustAttendance: adjustMutation.mutateAsync,
  };
}
