import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../../api/client';
import { useToast } from '../../../context/ToastContext';
import { getTodayVNString } from '../../../utils/dateUtils';

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
      try {
        const res = await apiFetch('/api/attendance/locks');
        if (res.success && Array.isArray(res.data)) {
          return res.data;
        }
      } catch {
        // Return default locked dates if backend endpoint fails
      }
      return [{ date: '2026-09-10', is_locked: true }];
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
      showToast(
        result.lock
          ? `Đã chốt ca làm việc ngày ${result.date} thành công!`
          : `Đã mở khoá chỉnh sửa ca làm việc ngày ${result.date}!`,
        result.lock ? 'success' : 'info'
      );
    },
    onError: (err: Error) => {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái chốt ca!', 'error');
    },
  });

  const isDateLocked = (date: string): boolean => {
    if (!date) return false;
    const today = getTodayVNString();

    const item = (query.data || []).find((l: LockItem) => l.date === date);
    if (item !== undefined) {
      return Boolean(item.is_locked);
    }

    // Khi đã qua 24h00 hoặc 0h00 (tức ngày trong quá khứ: date < today), tự động chốt ca
    if (date < today) {
      return true;
    }

    return false;
  };

  return {
    locks: query.data || [],
    isDateLocked,
    toggleLock: (date: string, lock: boolean) => toggleLockMutation.mutate({ date, lock }),
    isLoading: query.isLoading,
  };
}
