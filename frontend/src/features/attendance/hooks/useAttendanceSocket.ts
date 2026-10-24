import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { ATTENDANCE_QUERY_KEY } from '../../../hooks/useAttendance';

export interface LiveAttendanceEvent {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | 'UNKNOWN' | 'SPOOF_BLOCKED';
  employeeCode?: string;
  employeeName?: string;
  avatarUrl?: string | null;
  time: string;
  similarity?: number;
  antispoofScore?: number;
  deviceId?: string;
  message?: string;
}

interface UseAttendanceSocketOptions {
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export function useAttendanceSocket({ showToast }: UseAttendanceSocketOptions = {}) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<LiveAttendanceEvent[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socketBase = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    const socket = io(`${socketBase}/attendance`, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[Socket.IO] Đã kết nối tới namespace /attendance');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[Socket.IO] Mất kết nối tới namespace /attendance');
    });

    // Sự kiện nhân viên Check-in thành công
    socket.on('checked-in', (record: any) => {
      const empName = record.employees?.full_name || record.employee_name || 'Nhân viên';
      const empCode = record.employees?.employee_code || record.employee_code || record.employee_id || '';
      const eventTime = record.event_time ? new Date(record.event_time).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN');

      showToast?.(`[CHECK-IN] ${empName} (${empCode}) vừa vào ca lúc ${eventTime}`, 'success');

      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['daily-summaries'] });

      const newEvt: LiveAttendanceEvent = {
        id: `in-${Date.now()}-${Math.random()}`,
        type: 'CHECK_IN',
        employeeCode: empCode,
        employeeName: empName,
        avatarUrl: record.employees?.avatar_url,
        time: eventTime,
        similarity: record.similarity,
        deviceId: record.device_info || 'PI4_FRONT_GATE',
        message: 'Điểm danh vào ca thành công',
      };
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
    });

    // Sự kiện nhân viên Check-out thành công
    socket.on('checked-out', (record: any) => {
      const empName = record.employees?.full_name || record.employee_name || 'Nhân viên';
      const empCode = record.employees?.employee_code || record.employee_code || record.employee_id || '';
      const eventTime = record.event_time ? new Date(record.event_time).toLocaleTimeString('vi-VN') : new Date().toLocaleTimeString('vi-VN');

      showToast?.(`[CHECK-OUT] ${empName} (${empCode}) vừa tan ca lúc ${eventTime}`, 'success');

      queryClient.invalidateQueries({ queryKey: ATTENDANCE_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['daily-summaries'] });

      const newEvt: LiveAttendanceEvent = {
        id: `out-${Date.now()}-${Math.random()}`,
        type: 'CHECK_OUT',
        employeeCode: empCode,
        employeeName: empName,
        avatarUrl: record.employees?.avatar_url,
        time: eventTime,
        similarity: record.similarity,
        deviceId: record.device_info || 'PI4_FRONT_GATE',
        message: 'Điểm danh tan ca thành công',
      };
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
    });

    // Cảnh báo người lạ (không tìm thấy trong CSDL)
    socket.on('attendance-unknown', (data: any) => {
      showToast?.('Phát hiện khuôn mặt chưa đăng ký trong hệ thống!', 'warning');
      const newEvt: LiveAttendanceEvent = {
        id: `unknown-${Date.now()}`,
        type: 'UNKNOWN',
        time: new Date().toLocaleTimeString('vi-VN'),
        similarity: data?.similarity,
        deviceId: data?.device_id || 'PI4_FRONT_GATE',
        message: 'Khuôn mặt chưa được đăng ký trong hệ thống',
      };
      setLiveEvents((prev) => [newEvt, ...prev.slice(0, 9)]);
    });

    // Cảnh báo phát hiện giả mạo khuôn mặt
    socket.on('attendance-spoof-blocked', (data: any) => {
      showToast?.('CẢNH BÁO: Đã chặn hành vi giả mạo khuôn mặt!', 'error');
      const newEvt: LiveAttendanceEvent = {
        id: `spoof-${Date.now()}`,
        type: 'SPOOF_BLOCKED',
        time: new Date().toLocaleTimeString('vi-VN'),
        antispoofScore: data?.antispoof_score,
        deviceId: data?.device_id || 'PI4_FRONT_GATE',
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
    clearEvents: () => setLiveEvents([]),
  };
}
