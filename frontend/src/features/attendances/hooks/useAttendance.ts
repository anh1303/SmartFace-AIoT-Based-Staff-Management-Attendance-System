import { useMemo, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAttendanceApi, addAttendanceApi, FetchAttendanceParams } from '../api/attendanceApi';
import { AttendanceRecord } from '../../../types';
import { useToast } from '../../../context/ToastContext';

export const ATTENDANCE_QUERY_KEY = ['attendance'] as const;

export function useAttendance(params?: FetchAttendanceParams) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  useEffect(() => {
    if (!currentUser || (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true')) return;
    const base = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(`${base}/attendance`, { withCredentials: true });
    let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      for (const domain of ['attendance', 'attendanceSummaries', 'attendanceAdjustments', 'dashboard', 'payroll', 'payrolls']) {
        void queryClient.invalidateQueries({ queryKey: [domain] });
      }
    };
    const changed = () => {
      if (pendingRefresh) return;
      pendingRefresh = setTimeout(() => {
        pendingRefresh = undefined;
        refresh();
        showToast('Chấm công vừa được cập nhật. Đang đồng bộ dữ liệu các trang.', 'info', "Cập nhật chấm công");
      }, 50);
    };
    socket.on('connect', refresh);
    for (const event of ['checked-in', 'checked-out', 'attendance-summary-updated']) socket.on(event, changed);
    return () => { if (pendingRefresh) clearTimeout(pendingRefresh); socket.disconnect(); };
  }, [currentUser?.employee_id, queryClient]);

  // Chuẩn hóa và sort các key của params để đảm bảo queryKey ổn định, tránh cache miss khi params bị re-create
  const stableParams = useMemo(() => {
    if (!params) return undefined;
    const sortedKeys = (Object.keys(params) as (keyof FetchAttendanceParams)[]).sort();
    const sortedObj: Partial<FetchAttendanceParams> = {};
    for (const k of sortedKeys) {
      if (params[k] !== undefined) {
        (sortedObj as Record<string, unknown>)[k] = params[k];
      }
    }
    return sortedObj;
  }, [params ? JSON.stringify(params) : null]);

  const queryKey = useMemo(() => {
    return stableParams ? [...ATTENDANCE_QUERY_KEY, stableParams] : ATTENDANCE_QUERY_KEY;
  }, [stableParams]);

  const query = useQuery({
    queryKey,
    enabled: Boolean(currentUser),
    queryFn: () => fetchAttendanceApi(stableParams),
    staleTime: 1000 * 60 * 2, // 2 minutes cache
    retry: 1,
  });

  const addAttendanceMutation = useMutation({
    mutationFn: (record: Omit<AttendanceRecord, 'attendance_id'>) => addAttendanceApi(record),
    onSuccess: (result) => {
      if (result?.ignored) {
        showToast(result.message || 'Lượt chấm công gần đây đã được ghi nhận. Đã bỏ qua lượt quét lặp.', 'info', "Chấm công");
        return;
      }
      showToast('Điểm danh thành công', 'success', "Chấm công thành công");
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      showToast(`Lỗi khi điểm danh: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error', "Không thể chấm công");
    },
  });

  return {
    attendance: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    isTruncated: Boolean((query.data as any)?.isTruncated),
    refetchAttendance: query.refetch,
    addAttendanceRecord: (record: Omit<AttendanceRecord, 'attendance_id'>) => addAttendanceMutation.mutate(record),
  };
}
