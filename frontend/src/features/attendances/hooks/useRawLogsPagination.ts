import { useState, useEffect, useRef, useCallback } from 'react';
import { AttendanceRecord } from '../../../types';
import { fetchAttendancePaginatedApi } from '../api/attendanceApi';

export interface UseRawLogsPaginationOptions {
  startDate?: string;
  endDate?: string;
  pageSize?: number;
  showToast?: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export function useRawLogsPagination({
  startDate,
  endDate,
  pageSize = 50,
  showToast,
}: UseRawLogsPaginationOptions) {
  const [showRawLogs, setShowRawLogs] = useState(false);
  const [rawLogPage, setRawLogPage] = useState(1);
  const [rawLogsData, setRawLogsData] = useState<AttendanceRecord[]>([]);
  const [hasMoreRawLogs, setHasMoreRawLogs] = useState(false);
  const [isLoadingRawLogs, setIsLoadingRawLogs] = useState(false);

  const latestReqIdRef = useRef(0);

  const loadRawLogsPage = useCallback(async (page: number) => {
    const reqId = ++latestReqIdRef.current;
    setIsLoadingRawLogs(true);
    try {
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
        showToast?.('Không thể tải trang nhật ký quẹt thẻ', 'error');
      }
    } finally {
      if (reqId === latestReqIdRef.current) {
        setIsLoadingRawLogs(false);
      }
    }
  }, [startDate, endDate, pageSize, showToast]);

  useEffect(() => {
    if (showRawLogs) {
      loadRawLogsPage(1);
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
