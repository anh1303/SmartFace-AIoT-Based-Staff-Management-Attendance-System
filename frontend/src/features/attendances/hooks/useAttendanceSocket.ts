import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ATTENDANCE_QUERY_KEY, type AttendanceSocketEventName } from './useAttendance';
import { useAttendanceContext } from '../context/AttendanceContext';
import { fetchAttendanceApi } from '../api/attendanceApi';
import type { AttendanceRecord } from '../types';
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

export interface ExternalTodayLogs {
  data?: AttendanceRecord[];
  isPending?: boolean;
  isError?: boolean;
  refetch?: () => unknown;
}

export interface UseAttendanceSocketOptions {
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
  externalTodayLogs?: ExternalTodayLogs;
}

export function useAttendanceSocket({ showToast, externalTodayLogs }: UseAttendanceSocketOptions = {}) {
  const { isSocketConnected, subscribeAttendanceSocket } = useAttendanceContext({ loadData: false });
  const [liveEvents, setLiveEvents] = useState<LiveAttendanceEvent[]>([]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const [today, setToday] = useState(getTodayVNString);

  const hasExternalLogs = Boolean(externalTodayLogs);
  const todayLogs = useQuery({
    queryKey: [...ATTENDANCE_QUERY_KEY, 'today-log', today],
    enabled: !hasExternalLogs,
    queryFn: () => fetchAttendanceApi({ date: today, fetchAllPages: true }),
  });

  useEffect(() => {
    const timer = setInterval(() => setToday(getTodayVNString()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleEvent = (event: AttendanceSocketEventName, payload: any) => {
      if (event === 'checked-in') {
        const record = payload;
        const recordId = String(record.id || record.attendance_id || record.raw_event_id || `in-${Date.now()}`);
        if (seenEventIdsRef.current.has(recordId)) return;
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

        showToastRef.current?.(`[CHECK-IN] ${empName} (${empCode}) vừa vào ca lúc ${eventTime}`, 'success', 'Chấm công vào ca thành công');

        setLiveEvents((prev) => [{
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
        }, ...prev]);
        return;
      }

      if (event === 'checked-out') {
        const record = payload;
        const recordId = String(record.id || record.attendance_id || record.raw_event_id || `out-${Date.now()}`);
        if (seenEventIdsRef.current.has(recordId)) return;
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

        showToastRef.current?.(`[CHECK-OUT] ${empName} (${empCode}) vừa tan ca lúc ${eventTime}`, 'success', 'Chấm công tan ca thành công');

        setLiveEvents((prev) => [{
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
        }, ...prev]);
        return;
      }

      if (event === 'attendance-flagged') {
        const data = payload;
        const id = `flagged-${data?.device_id || ''}-${data?.event_id || data?.timestamp || Date.now()}`;
        if (seenEventIdsRef.current.has(id)) return;
        seenEventIdsRef.current.add(id);
        const timestamp = data?.timestamp || new Date().toISOString();
        showToastRef.current?.('Điểm danh bị gắn cờ và từ chối.', 'error', 'Chấm công bị từ chối');
        setLiveEvents((prev) => [{
          id,
          type: 'FLAGGED',
          employeeCode: data?.employee_id,
          deviceId: data?.device_id,
          time: new Date(timestamp).toLocaleTimeString('vi-VN'),
          timestamp,
          message: 'Điểm danh bị gắn cờ và từ chối',
        }, ...prev]);
        return;
      }

      if (event === 'attendance-unknown') {
        const data = payload;
        const recordId = `unknown-${data?.timestamp || Date.now()}`;
        if (seenEventIdsRef.current.has(recordId)) return;
        seenEventIdsRef.current.add(recordId);

        showToastRef.current?.('Phát hiện khuôn mặt chưa đăng ký trong hệ thống!', 'error', 'Không thể cập nhật Face ID');
        const deviceId = data?.device_id || data?.deviceId || undefined;
        const similarity = data?.similarity ?? (data?.score ? Number(data.score) : undefined);
        const rawTimestamp = data?.timestamp || new Date().toISOString();

        setLiveEvents((prev) => [{
          id: recordId,
          type: 'UNKNOWN',
          time: new Date(rawTimestamp).toLocaleTimeString('vi-VN'),
          timestamp: rawTimestamp,
          similarity,
          verificationScore: similarity ?? null,
          deviceId,
          message: 'Khuôn mặt chưa được đăng ký trong hệ thống',
        }, ...prev]);
        return;
      }

      if (event === 'attendance-spoof-blocked') {
        const data = payload;
        const recordId = `spoof-${data?.timestamp || Date.now()}`;
        if (seenEventIdsRef.current.has(recordId)) return;
        seenEventIdsRef.current.add(recordId);

        showToastRef.current?.('CẢNH BÁO: Đã chặn hành vi giả mạo khuôn mặt!', 'error', 'Không thể thêm ảnh mẫu');
        const deviceId = data?.device_id || data?.deviceId || undefined;
        const rawTimestamp = data?.timestamp || new Date().toISOString();

        setLiveEvents((prev) => [{
          id: recordId,
          type: 'SPOOF_BLOCKED',
          time: new Date(rawTimestamp).toLocaleTimeString('vi-VN'),
          timestamp: rawTimestamp,
          antispoofScore: data?.antispoof_score,
          deviceId,
          message: 'Phát hiện hình ảnh/màn hình giả mạo (Anti-spoofing Blocked)',
        }, ...prev]);
      }
    };

    return subscribeAttendanceSocket(handleEvent, { handlesToast: Boolean(showToast) });
  }, [subscribeAttendanceSocket, Boolean(showToast)]);

  const sourceRecords = hasExternalLogs ? (externalTodayLogs?.data || []) : (todayLogs.data || []);

  const eventsById = new Map<string, LiveAttendanceEvent>();
  for (const record of sourceRecords) {
    if (record.type !== 'CHECK_IN' && record.type !== 'CHECK_OUT') continue;
    const id = String(record.id || record.attendance_id);
    eventsById.set(id, {
      id,
      type: record.type,
      employeeCode: record.employee_code || record.employee_id,
      employeeName: record.employee_name || 'Nhân viên',
      avatarUrl: record.avatar_url,
      time: formatVNTime(record.timestamp),
      timestamp: record.timestamp,
      verificationScore: record.verification_score,
      deviceId: record.device_id,
      message: record.type === 'CHECK_IN' ? 'Điểm danh vào ca thành công' : 'Điểm danh tan ca thành công',
    });
  }
  for (const event of liveEvents) {
    if (event.timestamp && formatVNDateISO(event.timestamp) === today) eventsById.set(event.id, event);
  }
  const todaysEvents = [...eventsById.values()]
    .filter((event) => event.timestamp && formatVNDateISO(event.timestamp) === today)
    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());

  return {
    isSocketConnected,
    liveEvents: todaysEvents,
    isLoadingEvents: hasExternalLogs ? Boolean(externalTodayLogs?.isPending) : todayLogs.isPending,
    eventsError: hasExternalLogs ? Boolean(externalTodayLogs?.isError) : todayLogs.isError,
    refetchEvents: hasExternalLogs ? (externalTodayLogs?.refetch ?? (() => Promise.resolve())) : todayLogs.refetch,
    clearEvents: () => {
      seenEventIdsRef.current.clear();
      setLiveEvents([]);
    },
  };
}
