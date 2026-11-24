import { useMemo, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '@/features/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAttendanceApi, addAttendanceApi, FetchAttendanceParams } from '../api/attendanceApi';
import type { AttendanceRecord } from '../types';
import { useToast } from '../../../context/ToastContext';

export const ATTENDANCE_QUERY_KEY = ['attendance'] as const;

export type AttendanceSocketEventName =
  | 'checked-in'
  | 'checked-out'
  | 'attendance-summary-updated'
  | 'attendance-flagged'
  | 'attendance-unknown'
  | 'attendance-spoof-blocked';

export interface UseAttendanceOptions {
  enabled?: boolean;
  connectSocket?: boolean;
  onSocketEvent?: (event: AttendanceSocketEventName, payload: any) => void;
  onSocketConnectionChange?: (connected: boolean) => void;
  hasDetailedToastListener?: () => boolean;
}

const ALL_SOCKET_EVENTS: AttendanceSocketEventName[] = [
  'checked-in',
  'checked-out',
  'attendance-summary-updated',
  'attendance-flagged',
  'attendance-unknown',
  'attendance-spoof-blocked',
];

const INVALIDATING_SOCKET_EVENTS = new Set<AttendanceSocketEventName>([
  'checked-in',
  'checked-out',
  'attendance-summary-updated',
  'attendance-flagged',
]);

export function useAttendance(params?: FetchAttendanceParams, options?: UseAttendanceOptions) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { currentUser } = useAuth();

  const onSocketEventRef = useRef(options?.onSocketEvent);
  onSocketEventRef.current = options?.onSocketEvent;
  const onSocketConnectionChangeRef = useRef(options?.onSocketConnectionChange);
  onSocketConnectionChangeRef.current = options?.onSocketConnectionChange;
  const hasDetailedToastListenerRef = useRef(options?.hasDetailedToastListener);
  hasDetailedToastListenerRef.current = options?.hasDetailedToastListener;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  const shouldConnectSocket = Boolean(options?.connectSocket);

  useEffect(() => {
    if (!shouldConnectSocket || !currentUser || (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true')) {
      onSocketConnectionChangeRef.current?.(false);
      return;
    }
    const base = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const socket = io(`${base}/attendance`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    let pendingRefresh: ReturnType<typeof setTimeout> | undefined;
    let hasConnectedOnce = false;

    const refresh = () => {
      for (const domain of ['attendance', 'attendanceSummaries', 'attendanceAdjustments', 'dashboard', 'payroll', 'payrolls']) {
        void queryClient.invalidateQueries({ queryKey: [domain] });
      }
    };

    const scheduleRefresh = (withToast: boolean) => {
      if (pendingRefresh) return;
      pendingRefresh = setTimeout(() => {
        pendingRefresh = undefined;
        refresh();
        if (withToast && !hasDetailedToastListenerRef.current?.()) {
          showToastRef.current('Chấm công vừa được cập nhật. Đang đồng bộ dữ liệu các trang.', 'info', 'Cập nhật chấm công');
        }
      }, 150);
    };

    socket.on('connect', () => {
      onSocketConnectionChangeRef.current?.(true);
      if (hasConnectedOnce) {
        refresh();
      }
      hasConnectedOnce = true;
    });
    socket.on('disconnect', () => {
      onSocketConnectionChangeRef.current?.(false);
    });

    for (const event of ALL_SOCKET_EVENTS) {
      socket.on(event, (payload: unknown) => {
        onSocketEventRef.current?.(event, payload);
        if (INVALIDATING_SOCKET_EVENTS.has(event)) {
          scheduleRefresh(event !== 'attendance-flagged');
        }
      });
    }

    return () => {
      if (pendingRefresh) clearTimeout(pendingRefresh);
      onSocketConnectionChangeRef.current?.(false);
      socket.disconnect();
    };
  }, [shouldConnectSocket, currentUser?.employee_id, queryClient]);

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
    enabled: Boolean(currentUser) && (options?.enabled ?? true),
    queryFn: () => fetchAttendanceApi(stableParams),
    staleTime: 1000 * 60 * 2, // 2 minutes cache
    retry: 1,
  });

  const addAttendanceMutation = useMutation({
    mutationFn: (record: Omit<AttendanceRecord, 'attendance_id'>) => addAttendanceApi(record),
    onSuccess: (result) => {
      if (result?.ignored) {
        showToast(result.message || 'Lượt chấm công gần đây đã được ghi nhận. Đã bỏ qua lượt quét lặp.', 'info', 'Chấm công');
        return;
      }
      showToast('Điểm danh thành công', 'success', 'Chấm công thành công');
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceAdjustments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => {
      showToast(`Lỗi khi điểm danh: ${error.message || 'Không thể kết nối đến máy chủ'}`, 'error', 'Không thể chấm công');
    },
  });

  const normalizedAttendance = useMemo(() => {
    if (!query.data) return [];
    const mapped = query.data.map(record => ({
      ...record,
      work_date: record.work_date ?? null,
    })) as typeof query.data;
    mapped.isTruncated = query.data.isTruncated;
    mapped.totalLoaded = query.data.totalLoaded;
    return mapped;
  }, [query.data]);

  return {
    attendance: normalizedAttendance,
    isLoading: query.isLoading,
    isError: query.isError,
    isTruncated: Boolean((query.data as any)?.isTruncated),
    refetchAttendance: query.refetch,
    addAttendanceRecord: (record: Omit<AttendanceRecord, 'attendance_id'>) => addAttendanceMutation.mutate(record),
  };
}
