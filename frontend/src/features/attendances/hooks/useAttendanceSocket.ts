import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { ATTENDANCE_QUERY_KEY } from './useAttendance';
import { fetchAttendanceApi } from '../api/attendanceApi';
import { getTodayVNString, formatVNDateISO, formatVNTime } from '../../../utils/dateUtils';

export interface LiveAttendanceEvent {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'UNKNOWN' | 'SPOOF_BLOCKED' | 'FLAGGED';
  employeeCode?: string;
  employeeName?: string;
  avatarUrl?: string | null;
  time: string;
  timestamp?: string;
  verificationScore?: number | null;
  similarity?: number;
  antispoofScore?: number;
  deviceId?: string;
  message?: string;
}

export interface UseAttendanceSocketOptions {
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
}

export function useAttendanceSocket({ showToast }: UseAttendanceSocketOptions = {}) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveAttendanceEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const [today, setToday] = useState(getTodayVNString);
  const todayLogs = useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEY, 'today-log', today],
    queryFn: () => fetchAttendanceApi({ date: today, fetchAllPages: true }),
  });

  useEffect(() => {
    const timer = setInterval(() => setToday(getTodayVNString()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE === 'true') return;
    const socketBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const socket = io(`${socketBase}/attendance`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      setIsConnected(true);
      console.log('[Socket.IO] Đã kết nối tới namespace /attendance');
      // Lấy lại dữ liệu công và summaries mới nhất sau khi reconnect
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });

    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket.IO] Mất kết nối tới namespace /attendance');
    });

    // Sự kiện nhân viên Check-in thành công
    socket.on('checked-in', (record: any) => {
      const recordId = String(record.id || record.attendance_id || record.raw_event_id || `in-${Date.now()}`);
      if (seenEventIdsRef.current.has(recordId)) {
        return; // Tránh thêm sự kiện trùng lặp
      }
      seenEventIdsRef.current.add(recordId);

      const empName = record.employee_name || record.employeeName || record.employees?.full_name || 'Nhân viên';
      const empCode = record.employee_code || record.employeeCode || record.employees?.employee_code || record.employee_id || '';
      const avatarUrl = record.avatar_url || record.avatarUrl || record.employees?.avatar_url || null;
      const deviceId = record.device_id || record.deviceId || record.device_info || undefined;
      const rawTimestamp = record.timestamp || record.event_time || new Date().toISOString();
      const eventTime = new Date(rawTimestamp).toLocaleTimeString('vi-VN');
      const verificationScore = record.verification_score !== undefined && record.verification_score !== null
        ? Number(record.verification_score)
        : (record.verificationScore ?? record.similarity ?? null);

      showToast?.(`[CHECK-IN] ${empName} (${empCode}) vừa vào ca lúc ${eventTime}`, 'success', "Chấm công vào ca thành công");

      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });

      const newEvt: LiveAttendanceEvent = {
        id: recordId,
        type: 'CHECK_IN',
        employeeCode: empCode,
        employeeName: empName,
        avatarUrl,
        time: eventTime,
        timestamp: rawTimestamp,
        verificationScore,
        similarity: verificationScore ?? undefined,
        deviceId,
        message: 'Điểm danh vào ca thành công',
      };
      setLiveEvents((prev) => [newEvt, ...prev]);
    });

    // Sự kiện nhân viên Check-out thành công
    socket.on('checked-out', (record: any) => {
      const recordId = String(record.id || record.attendance_id || record.raw_event_id || `out-${Date.now()}`);
      if (seenEventIdsRef.current.has(recordId)) {
        return; // Tránh thêm sự kiện trùng lặp
      }
      seenEventIdsRef.current.add(recordId);

      const empName = record.employee_name || record.employeeName || record.employees?.full_name || 'Nhân viên';
      const empCode = record.employee_code || record.employeeCode || record.employees?.employee_code || record.employee_id || '';
      const avatarUrl = record.avatar_url || record.avatarUrl || record.employees?.avatar_url || null;
      const deviceId = record.device_id || record.deviceId || record.device_info || undefined;
      const rawTimestamp = record.timestamp || record.event_time || new Date().toISOString();
      const eventTime = new Date(rawTimestamp).toLocaleTimeString('vi-VN');
      const verificationScore = record.verification_score !== undefined && record.verification_score !== null
        ? Number(record.verification_score)
        : (record.verificationScore ?? record.similarity ?? null);

      showToast?.(`[CHECK-OUT] ${empName} (${empCode}) vừa tan ca lúc ${eventTime}`, 'success', "Chấm công tan ca thành công");

      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });

      const newEvt: LiveAttendanceEvent = {
        id: recordId,
        type: 'CHECK_OUT',
        employeeCode: empCode,
        employeeName: empName,
        avatarUrl,
        time: eventTime,
        timestamp: rawTimestamp,
        verificationScore,
        similarity: verificationScore ?? undefined,
        deviceId,
        message: 'Điểm danh tan ca thành công',
      };
      setLiveEvents((prev) => [newEvt, ...prev]);
    });

    // Sự kiện Backend cập nhật bảng daily_attendance_summary (tính toán realtime hoặc điều chỉnh công)
    socket.on('attendance-summary-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
    });

    socket.on('attendance-flagged', (data: any) => {
      const id = `flagged-${data?.device_id || ''}-${data?.event_id || data?.timestamp || Date.now()}`;
      if (seenEventIdsRef.current.has(id)) return;
      seenEventIdsRef.current.add(id);
      const timestamp = data?.timestamp || new Date().toISOString();
      showToast?.('Điểm danh bị gắn cờ và từ chối.', 'error', "Chấm công bị từ chối");
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      setLiveEvents(prev => [{ id, type: 'FLAGGED', employeeCode: data?.employee_id, deviceId: data?.device_id, time: new Date(timestamp).toLocaleTimeString('vi-VN'), timestamp, message: 'Điểm danh bị gắn cờ và từ chối' }, ...prev]);
    });

    // Cảnh báo người lạ (không tìm thấy trong CSDL)
    socket.on('attendance-unknown', (data: any) => {
      const recordId = `unknown-${data?.timestamp || Date.now()}`;
      if (seenEventIdsRef.current.has(recordId)) return;
      seenEventIdsRef.current.add(recordId);

      showToast?.('Phát hiện khuôn mặt chưa đăng ký trong hệ thống!', 'error', "Không thể cập nhật Face ID");
      const deviceId = data?.device_id || data?.deviceId || undefined;
      const similarity = data?.similarity ?? (data?.score ? Number(data.score) : undefined);
      const rawTimestamp = data?.timestamp || new Date().toISOString();

      const newEvt: LiveAttendanceEvent = {
        id: recordId,
        type: 'UNKNOWN',
        time: new Date(rawTimestamp).toLocaleTimeString('vi-VN'),
        timestamp: rawTimestamp,
        similarity,
        verificationScore: similarity ?? null,
        deviceId,
        message: 'Khuôn mặt chưa được đăng ký trong hệ thống',
      };
      setLiveEvents((prev) => [newEvt, ...prev]);
    });

    // Cảnh báo phát hiện giả mạo khuôn mặt
    socket.on('attendance-spoof-blocked', (data: any) => {
      const recordId = `spoof-${data?.timestamp || Date.now()}`;
      if (seenEventIdsRef.current.has(recordId)) return;
      seenEventIdsRef.current.add(recordId);

      showToast?.('CẢNH BÁO: Đã chặn hành vi giả mạo khuôn mặt!', 'error', "Không thể thêm ảnh mẫu");
      const deviceId = data?.device_id || data?.deviceId || undefined;
      const rawTimestamp = data?.timestamp || new Date().toISOString();

      const newEvt: LiveAttendanceEvent = {
        id: recordId,
        type: 'SPOOF_BLOCKED',
        time: new Date(rawTimestamp).toLocaleTimeString('vi-VN'),
        timestamp: rawTimestamp,
        antispoofScore: data?.antispoof_score,
        deviceId,
        message: 'Phát hiện hình ảnh/màn hình giả mạo (Anti-spoofing Blocked)',
      };
      setLiveEvents((prev) => [newEvt, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, showToast]);

  const eventsById = new Map<string, LiveAttendanceEvent>();
  for (const record of todayLogs.data || []) {
    if (record.type !== 'CHECK_IN' && record.type !== 'CHECK_OUT') continue;
    const id = String(record.id || record.attendance_id);
    eventsById.set(id, {
      id, type: record.type,
      employeeCode: record.employee_code || record.employee_id,
      employeeName: record.employee_name || 'Nhân viên',
      avatarUrl: record.avatar_url,
      time: formatVNTime(record.timestamp), timestamp: record.timestamp,
      verificationScore: record.verification_score, deviceId: record.device_id,
      message: record.type === 'CHECK_IN' ? 'Điểm danh vào ca thành công' : 'Điểm danh tan ca thành công',
    });
  }
  for (const event of liveEvents) {
    if (event.timestamp && formatVNDateISO(event.timestamp) === today) eventsById.set(event.id, event);
  }
  const todaysEvents = [...eventsById.values()]
    .filter(event => event.timestamp && formatVNDateISO(event.timestamp) === today)
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

  return {
    isSocketConnected: isConnected,
    liveEvents: todaysEvents,
    isLoadingEvents: todayLogs.isPending,
    eventsError: todayLogs.isError,
    refetchEvents: todayLogs.refetch,
    clearEvents: () => {
      seenEventIdsRef.current.clear();
      setLiveEvents([]);
    },
  };
}
