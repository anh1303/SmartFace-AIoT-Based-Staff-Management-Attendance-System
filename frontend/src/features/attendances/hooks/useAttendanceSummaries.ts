import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

export interface BackendAttendanceSummaryItem {
  id: string;
  employee_id: string;
  employee_uuid: string;
  date: string;
  regular_hours: number;
  total_working_hours: number;
  raw_work_seconds: number;
  late_early: number;
  overtime: number;
  approved_overtime_hours: number;
  proposed_overtime_hours: number;
  pending_overtime_hours: number;
  status: string;
  first_check_in: string | null;
  last_check_out: string | null;
  needs_review: boolean;
  requires_review?: boolean;
  overtime_status?: string;
  overtime_candidate_hours?: number;
  calculation_details?: { pairs?: Array<{ inId: string; outId: string; start: string; end: string; counted?: boolean; regular_seconds?: number; overtime_seconds?: number; credited_regular_seconds?: number; credit_reason?: string }>; events?: Array<{ id: string; type: string; time: string; status: string; method?: string; device_info?: string; verification_score?: number | null }>; ignored?: Array<{ id: string; reason: string }>; [key: string]: unknown };
  review_reason: string | null;
  reason_labels?: Record<string, string>;
  policy_version: string | null;
  is_legacy_no_policy: boolean;
  shift_name?: string;
  shift_type?: string;
  pairs: Array<{
    in_time: string | null;
    out_time: string | null;
    duration_seconds: number;
    is_valid: boolean;
    method: string;
    device_info: string | null;
    score: number | null;
  }>;
  raw_events: Array<{
    id: string;
    time: string;
    type: 'CHECK_IN' | 'CHECK_OUT';
    method: string;
    device_id?: string | null;
    verification_score?: number | null;
    status: string;
  }>;
}

export interface SummaryMap {
  customOvertimeMap: Record<string, number>;
  customLateEarlyMap: Record<string, number>;
  workingHoursMap: Record<string, number>;
  statusMap: Record<string, string>;
  summaryMap: Record<string, BackendAttendanceSummaryItem>;
  summaries: BackendAttendanceSummaryItem[];
}

export function useAttendanceSummaries(startDate?: string, endDate?: string, employeeId?: string) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const effectiveEnd = endDate || startDate;

  const query = useQuery({
    queryKey: ['attendanceSummaries', startDate || 'ALL', effectiveEnd || 'ALL', employeeId || 'ALL'],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (startDate) searchParams.append('startDate', startDate);
      if (effectiveEnd) searchParams.append('endDate', effectiveEnd);
      if (employeeId) searchParams.append('employeeId', employeeId);

      const qs = searchParams.toString();
      const url = qs ? `/api/attendance/summaries?${qs}` : '/api/attendance/summaries';
      const res = await apiFetch(url);
      if (!res.success) throw new Error(res.message || 'Không tải được kết quả tổng hợp công');

      const otMap: Record<string, number> = {};
      const leMap: Record<string, number> = {};
      const whMap: Record<string, number> = {};
      const stMap: Record<string, string> = {};
      const sumMap: Record<string, BackendAttendanceSummaryItem> = {};
      const summariesList: BackendAttendanceSummaryItem[] = [];

      if (res.success && Array.isArray(res.data)) {
        res.data.forEach((s: BackendAttendanceSummaryItem) => {
          summariesList.push(s);
          const otSec = Math.round((Number(s.approved_overtime_hours ?? s.overtime) || 0) * 3600);
          const leSec = Math.round((Number(s.late_early) || 0) * 3600);
          const wh = Number(s.regular_hours ?? s.total_working_hours) || 0;
          const status = s.status || 'PRESENT';

          const keys = [
            `${s.employee_id}_${s.date}`,
            s.employee_uuid ? `${s.employee_uuid}_${s.date}` : null,
          ].filter(Boolean) as string[];

          keys.forEach((k) => {
            otMap[k] = otSec;
            leMap[k] = leSec;
            whMap[k] = wh;
            stMap[k] = status;
            sumMap[k] = s;
          });
        });
      }

      return {
        customOvertimeMap: otMap,
        customLateEarlyMap: leMap,
        workingHoursMap: whMap,
        statusMap: stMap,
        summaryMap: sumMap,
        summaries: summariesList,
      };
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
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err: Error) => {
      showToast(err.message || 'Không thể kết nối đến máy chủ để lưu thay đổi!', 'error');
    },
  });

  return {
    customOvertimeMap: query.data?.customOvertimeMap || {},
    customLateEarlyMap: query.data?.customLateEarlyMap || {},
    workingHoursMap: query.data?.workingHoursMap || {},
    statusMap: query.data?.statusMap || {},
    summaryMap: query.data?.summaryMap || {},
    summaries: query.data?.summaries || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    adjustAttendance: adjustMutation.mutateAsync,
  };
}
