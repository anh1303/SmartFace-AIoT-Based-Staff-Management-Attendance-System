import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchShiftsApi, assignShiftApi, type FetchShiftsParams } from '../api/shiftApi';
import type { WorkShift } from '../types';


export const SHIFTS_QUERY_KEY = ['shifts'] as const;

/**
 * Feature Hook: Quản lý lịch ca làm việc và phân ca nhân sự.
 */
export function useShifts(enabled = true, params?: FetchShiftsParams) {
  const queryClient = useQueryClient();

  const stableParams = useMemo<FetchShiftsParams | undefined>(() => {
    if (!params) return undefined;
    const normalized: FetchShiftsParams = {};
    if (params.startDate) normalized.startDate = params.startDate;
    if (params.endDate) normalized.endDate = params.endDate;
    if (params.employeeId) normalized.employeeId = params.employeeId;
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }, [params?.startDate, params?.endDate, params?.employeeId]);

  const queryKey = useMemo(
    () => (stableParams ? [...SHIFTS_QUERY_KEY, stableParams] : SHIFTS_QUERY_KEY),
    [stableParams],
  );

  const query = useQuery({
    queryKey,
    enabled,
    queryFn: () => fetchShiftsApi(stableParams),
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
