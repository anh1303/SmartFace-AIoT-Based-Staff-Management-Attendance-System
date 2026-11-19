import { useState, useEffect, useRef, useCallback } from 'react';
import { AttendanceRecord } from '../../../types';
import { fetchAttendanceApi, fetchAttendancePaginatedApi } from '../api/attendanceApi';
import { compareEmployeeNames } from '../../../hooks/useTableSort';

export interface UseRawLogsPaginationOptions {
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  employeeNameSort?: 'none' | 'ascending' | 'descending';
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info', title?: string) => void;
}

export function useRawLogsPagination({
  startDate,
  endDate,
  pageSize = 50,
  employeeNameSort = 'none',
  showToast,
}: UseRawLogsPaginationOptions) {
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [rawLogPage, setRawLogPage] = useState(1);
  const [rawLogsData, setRawLogsData] = useState<AttendanceRecord[]>([]);
  const [hasMoreRawLogs, setHasMoreRawLogs] = useState(false);
  const [isLoadingRawLogs, setIsLoadingRawLogs] = useState(false);

  const latestReqIdRef = useRef(0);
  const sortedLogsCache = useRef<{ range: string; logs: AttendanceRecord[] } | null>(null);

  const loadRawLogsPage = useCallback(async (page: number, refresh = false) => {
    if (refresh) sortedLogsCache.current = null;
    const reqId = ++latestReqIdRef.current;
    setIsLoadingRawLogs(true);
    try {
      if (employeeNameSort !== 'none') {
        const range = JSON.stringify([startDate, endDate]);
        let logs = sortedLogsCache.current?.range === range ? sortedLogsCache.current.logs : undefined;
        if (!logs) {
          logs = await fetchAttendanceApi({ startDate, endDate, fetchAllPages: true });
          if (reqId !== latestReqIdRef.current) return;
          sortedLogsCache.current = { range, logs };
        }
        const direction = employeeNameSort === 'ascending' ? 1 : -1;
        const sorted = [...logs].sort((a, b) => direction * compareEmployeeNames(a.employee_name || a.employee_id, b.employee_name || b.employee_id));
        setRawLogsData(sorted.slice((page - 1) * pageSize, page * pageSize));
        setHasMoreRawLogs(page * pageSize < sorted.length);
        setRawLogPage(page);
        return;
      }
      const res = await fetchAttendancePaginatedApi({
        startDate,
        endDate,
        page,
        limit: pageSize,
      });
      if (reqId !== latestReqIdRef.current) return;
      setRawLogsData(res.data);
      setHasMoreRawLogs(res.hasMore);
      setRawLogPage(page);
    } catch {
      if (reqId === latestReqIdRef.current) {
        showToast?.('Không thể tải trang nhật ký quẹt thẻ', 'error', "Không thể tải nhật ký chấm công");
      }
    } finally {
      if (reqId === latestReqIdRef.current) {
        setIsLoadingRawLogs(false);
      }
    }
  }, [startDate, endDate, pageSize, showToast, employeeNameSort]);

  useEffect(() => {
    if (showRawLogs) {
      loadRawLogsPage(1);
    } else {
      sortedLogsCache.current = null;
    }
  }, [showRawLogs, startDate, endDate, loadRawLogsPage]);

  return {
    showRawLogs,
    setShowRawLogs,
    rawLogPage,
    setRawLogPage,
    rawLogPageSize: pageSize,
    rawLogsData,
    setRawLogsData,
    hasMoreRawLogs,
    isLoadingRawLogs,
    loadRawLogsPage,
  };
}
