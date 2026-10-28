import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchShiftsApi, assignShiftApi } from '../../../api/shiftApi';
import { WorkShift } from '../../../types';


export const SHIFTS_QUERY_KEY = ['shifts'];

/**
 * Feature Hook: Quản lý lịch ca làm việc và phân ca nhân sự.
 */
export function useShifts() {
  const queryClient = useQueryClient();


  const query = useQuery({
    queryKey: SHIFTS_QUERY_KEY,
    queryFn: fetchShiftsApi,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const assignShiftMutation = useMutation({
    mutationFn: (shiftData: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => assignShiftApi(shiftData),
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
    },

  });

  return {
    workShifts: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    refetchShifts: query.refetch,
    assignOrUpdateShift: (shift: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) => assignShiftMutation.mutateAsync(shift),
  };
}
