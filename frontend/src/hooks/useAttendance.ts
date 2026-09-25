import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAttendanceApi, addAttendanceApi } from '../api/attendanceApi';
import { AttendanceRecord } from '../types';
import { useToast } from '../context/ToastContext';

export const ATTENDANCE_QUERY_KEY = ['attendance'];

export function useAttendance() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ATTENDANCE_QUERY_KEY,
    queryFn: fetchAttendanceApi,
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
