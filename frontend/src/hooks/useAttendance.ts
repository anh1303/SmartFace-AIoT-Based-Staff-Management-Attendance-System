import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAttendanceApi, addAttendanceApi, FetchAttendanceParams } from '../api/attendanceApi';
import { AttendanceRecord } from '../types';
import { useToast } from '../context/ToastContext';

export const ATTENDANCE_QUERY_KEY = ['attendance'];

export function useAttendance(params?: FetchAttendanceParams) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  useEffect(() => {
    if (!currentUser) return;
    const base = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socket = io(`${base}/attendance`, { withCredentials: true });
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
    };
    for (const event of ['connect', 'checked-in', 'checked-out', 'attendance-summary-updated']) socket.on(event, refresh);
    return () => { socket.disconnect(); };
  }, [currentUser?.employee_id, queryClient]);

  const queryKey = params ? [...ATTENDANCE_QUERY_KEY, params] : ATTENDANCE_QUERY_KEY;

  const query = useQuery({
    queryKey,
    enabled: Boolean(currentUser),
    queryFn: () => fetchAttendanceApi(params),
    staleTime: 1000 * 60 * 2, // 2 minutes cache
    retry: 1,
  });

  const addAttendanceMutation = useMutation({
    mutationFn: (record: Omit<AttendanceRecord, 'attendance_id'>) => addAttendanceApi(record),
    onSuccess: () => {
      showToast('Điểm danh thành công', 'success');
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
    },
    onError: (error: Error) => {
      showToast(`Lỗi khi điểm danh: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
  });

  return {
    attendance: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetchAttendance: query.refetch,
    addAttendanceRecord: (record: Omit<AttendanceRecord, 'attendance_id'>) => addAttendanceMutation.mutate(record),
  };
}
