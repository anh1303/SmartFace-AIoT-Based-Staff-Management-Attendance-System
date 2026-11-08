import { apiFetch } from '../../../api/client';
import { AttendanceRecord } from '../../../types';

export interface FetchAttendanceParams {
  startDate?: string;
  endDate?: string;
  date?: string;
  employeeId?: string;
  type?: string;
  limit?: number | string;
  page?: number;
  fetchAllPages?: boolean;
  onTruncated?: (totalLoaded: number) => void;
}

export type AttendanceRecordList = AttendanceRecord[] & {
  isTruncated?: boolean;
  totalLoaded?: number;
};

export interface PaginatedAttendanceResponse {
  data: AttendanceRecord[];
  page: number;
  limit: number;
  hasMore: boolean;
  totalLoaded: number;
}

/**
 * Lấy danh sách nhật ký chấm công.
 * Mặc định chỉ tải một trang; fetchAllPages dành cho màn hình cần đủ khoảng ngày hoặc export.
 */
export async function fetchAttendanceApi(params?: FetchAttendanceParams): Promise<AttendanceRecordList> {
  // Full-range consumers opt in; ordinary screens fetch exactly one small page.
  const maximum = params?.fetchAllPages ? 5000 : 200;
  const pageSize = Math.min(maximum, Math.max(1, Math.floor(Number(params?.limit) || (params?.fetchAllPages ? 5000 : 50))));
  let currentPage = Math.max(1, Math.floor(Number(params?.page) || 1));

  const buildUrl = (page: number, limit: number | string) => {
    const searchParams = new URLSearchParams();
    searchParams.set('compact', 'true');
    if (params?.fetchAllPages) searchParams.set('fetchAllPages', 'true');
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.date) searchParams.append('date', params.date);
    if (params?.employeeId) searchParams.append('employeeId', params.employeeId);
    if (params?.type) searchParams.append('type', params.type);
    searchParams.append('limit', String(limit));
    searchParams.append('page', String(page));
    return `/api/attendance?${searchParams.toString()}`;
  };

  // Không tự tải tiếp các trang khi một sự kiện realtime làm query chạy lại.
  if (!params?.fetchAllPages) {
    const res = await apiFetch(buildUrl(currentPage, pageSize));
    if (res.success && Array.isArray(res.data)) {
      const records: AttendanceRecordList = res.data;
      records.totalLoaded = records.length;
      records.isTruncated = records.length === pageSize;
      if (records.isTruncated) params?.onTruncated?.(records.length);
      return records;
    }
    throw new Error(res.message || 'Unable to load attendance page');
  }

  // Tự động phân trang tiếp để nạp trọn vẹn lịch sử không bị ngắt ở 5000 bản ghi
  const allRecords: AttendanceRecordList = [];
  while (true) {
    const res = await apiFetch(buildUrl(currentPage, pageSize));
    if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'Không thể tải nhật ký chấm công');
    if (res.data.length === 0) {
      break;
    }
    allRecords.push(...res.data);
    if (res.data.length < pageSize) break;
    currentPage++;
  }

  allRecords.totalLoaded = allRecords.length;
  return allRecords;
}

/**
 * Lấy lịch sử log raw theo từng trang để hiển thị phân trang UI.
 */
export async function fetchAttendancePaginatedApi(
  params?: FetchAttendanceParams
): Promise<PaginatedAttendanceResponse> {
  const pageSize = Math.min(200, Math.max(1, Math.floor(Number(params?.limit) || 50)));
  const page = Math.max(1, Math.floor(Number(params?.page) || 1));

  const searchParams = new URLSearchParams();
  searchParams.set('compact', 'true');
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.date) searchParams.append('date', params.date);
  if (params?.employeeId) searchParams.append('employeeId', params.employeeId);
  if (params?.type) searchParams.append('type', params.type);
  searchParams.append('limit', String(pageSize));
  searchParams.append('page', String(page));

  const res = await apiFetch(`/api/attendance?${searchParams.toString()}`);
  if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'Unable to load attendance page');
  const records: AttendanceRecord[] = res.data;

  return {
    data: records,
    page,
    limit: pageSize,
    hasMore: records.length === pageSize,
    totalLoaded: records.length,
  };
}

export async function addAttendanceApi(record: Omit<AttendanceRecord, 'attendance_id'>) {
  const endpoint = record.type === 'CHECK_IN' ? 'check-in' : 'check-out';
  const res = await apiFetch(`/api/attendance/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      employeeId: record.employee_id,
      event_id: crypto.randomUUID(),
      device_info: record.device_id,
      method: record.method,
    }),
  });
  return res.data;
}

export async function adjustAttendanceApi(payload: {
  employeeId: string;
  date: string;
  late_early: number;
  overtime: number;
  reason: string;
}) {
  const res = await apiFetch('/api/attendance/adjust', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.success) {
    throw new Error(res.message || 'Lỗi điều chỉnh dữ liệu chấm công');
  }
  return res.data;
}
