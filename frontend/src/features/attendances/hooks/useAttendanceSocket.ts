import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { ATTENDANCE_QUERY_KEY } from './useAttendance';

export interface LiveAttendanceEvent {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'UNKNOWN' | 'SPOOF_BLOCKED';
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
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useAttendanceSocket({ showToast }: UseAttendanceSocketOptions = {}) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveAttendanceEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const socketBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
    const socket = io(`${socketBase}/attendance`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
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
      const deviceId = record.device_id || record.deviceId || record.device_info || 'PI4_FRONT_GATE';
      const rawTimestamp = record.timestamp || record.event_time || new Date().toISOString();
      const eventTime = new Date(rawTimestamp).toLocaleTimeString('vi-VN');
      const verificationScore = record.verification_score !== undefined && record.verification_score !== null
        ? Number(record.verification_score)
        : (record.verificationScore ?? record.similarity ?? null);

      showToast?.(`[CHECK-IN] ${empName} (${empCode}) vừa vào ca lúc ${eventTime}`, 'success');

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
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
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
      const deviceId = record.device_id || record.deviceId || record.device_info || 'PI4_FRONT_GATE';
      const rawTimestamp = record.timestamp || record.event_time || new Date().toISOString();
      const eventTime = new Date(rawTimestamp).toLocaleTimeString('vi-VN');
      const verificationScore = record.verification_score !== undefined && record.verification_score !== null
        ? Number(record.verification_score)
        : (record.verificationScore ?? record.similarity ?? null);

      showToast?.(`[CHECK-OUT] ${empName} (${empCode}) vừa tan ca lúc ${eventTime}`, 'success');

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
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
    });

    // Sự kiện Backend cập nhật bảng daily_attendance_summary (tính toán realtime hoặc điều chỉnh công)
    socket.on('attendance-summary-updated', () => {
      queryClient.invalidateQueries({ queryKey: ['attendanceSummaries'] });
      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
    });

    // Cảnh báo người lạ (không tìm thấy trong CSDL)
    socket.on('attendance-unknown', (data: any) => {
      const recordId = `unknown-${data?.timestamp || Date.now()}`;
      if (seenEventIdsRef.current.has(recordId)) return;
      seenEventIdsRef.current.add(recordId);

      showToast?.('Phát hiện khuôn mặt chưa đăng ký trong hệ thống!', 'warning');
      const deviceId = data?.device_id || data?.deviceId || 'PI4_FRONT_GATE';
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
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
    });

    // Cảnh báo phát hiện giả mạo khuôn mặt
    socket.on('attendance-spoof-blocked', (data: any) => {
      const recordId = `spoof-${data?.timestamp || Date.now()}`;
      if (seenEventIdsRef.current.has(recordId)) return;
      seenEventIdsRef.current.add(recordId);

      showToast?.('CẢNH BÁO: Đã chặn hành vi giả mạo khuôn mặt!', 'error');
      const deviceId = data?.device_id || data?.deviceId || 'PI4_FRONT_GATE';
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
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient, showToast]);

  return {
    isSocketConnected: isConnected,
    liveEvents,
    clearEvents: () => {
      seenEventIdsRef.current.clear();
      setLiveEvents([]);
    },
  };
}
