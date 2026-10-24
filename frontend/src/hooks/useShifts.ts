import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchShiftsApi, assignShiftApi } from '../api/shiftApi';
import { WorkShift } from '../types';
import { useToast } from '../context/ToastContext';

export const SHIFTS_QUERY_KEY = ['shifts'];

export function useShifts() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: fetchShiftsApi,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const assignShiftMutation = useMutation({
    mutationFn: (shiftData: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => assignShiftApi(shiftData),
    onSuccess: (savedShift) => {
      const dateStr = savedShift?.date || '';
      showToast(`Đã lưu lịch làm việc${dateStr ? ` ngày ${dateStr}` : ''} vào CSDL`, 'success');
      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
    },
    onError: (error: Error) => {
      showToast(`Lỗi khi lưu ca làm việc: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error');
    },
  });

  return {
    workShifts: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetchShifts: query.refetch,
    assignOrUpdateShift: (shift: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => assignShiftMutation.mutate(shift),
  };
}
