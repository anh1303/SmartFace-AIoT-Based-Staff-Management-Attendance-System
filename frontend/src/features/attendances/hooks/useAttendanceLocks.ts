import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';

export interface LockItem {
  date: string;
  is_locked: boolean;
  locked_at?: string;
  locked_by?: string;
}

export function useAttendanceLocks() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const query = useQuery({
    queryKey: ['attendanceLocks'],
    queryFn: async () => {
      const res = await apiFetch('/api/attendance/locks');
      if (!res.success || !Array.isArray(res.data)) throw new Error('Không thể tải trạng thái chốt ca');
      return res.data;
    },
    staleTime: 1000 * 60, // 1 phút
    refetchInterval: 1000 * 60, // Tự động refetch mỗi phút để cập nhật khi qua 0h00
  });

  const toggleLockMutation = useMutation({
    mutationFn: async ({ date, lock }: { date: string; lock: boolean }) => {
      const endpoint = lock ? '/api/attendance/locks/lock' : '/api/attendance/locks/unlock';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ date }),
      });
      if (!res.success) {
        throw new Error(res.message || 'Lỗi khi thay đổi trạng thái chốt ca');
      }
      return { date, lock };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendanceLocks'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['payrolls'] });
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      showToast(
        result.lock
          ? `Đã chốt ca làm việc ngày ${result.date} thành công!`
          : `Đã mở khoá chỉnh sửa ca làm việc ngày ${result.date}!`,
        'success',
        result.lock ? 'Chốt ngày công thành công' : 'Mở khóa ngày công thành công');
    },
    onError: (err: Error) => {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái chốt ca!', 'error', "Không thể cập nhật trạng thái ngày công");
    },
  });

  const isDateLocked = (date: string): boolean => {
    if (!date) return false;
    const item = (query.data || []).find((l: LockItem) => l.date === date);
    return Boolean(item?.is_locked);
  };

  return {
    locks: query.data || [],
    isDateLocked,
    toggleLock: (date: string, lock: boolean) => toggleLockMutation.mutate({ date, lock }),
    toggleLockAsync: (date: string, lock: boolean) => toggleLockMutation.mutateAsync({ date, lock }),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
