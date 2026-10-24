import { apiFetch } from './client';
import { AttendanceRecord } from '../types';

export interface FetchAttendanceParams {
  startDate?: string;
  endDate?: string;
  date?: string;
  employeeId?: string;
  type?: string;
  limit?: number | string;
  page?: number;
  fetchAllPages?: boolean;
}

export interface PaginatedAttendanceResponse {
  data: AttendanceRecord[];
  page: number;
  limit: number;
  hasMore: boolean;
  totalLoaded: number;
}

/**
 * Lấy danh sách nhật ký chấm công.
 * Hỗ trợ phân trang liên tục hoặc tự động nạp tiếp các trang (auto-paginate)
 * để lịch sử không bị dừng âm thầm ở mốc 5.000 bản ghi.
 */
export async function fetchAttendanceApi(params?: FetchAttendanceParams): Promise<AttendanceRecord[]> {
  const pageSize = Number(params?.limit) || 5000;
  let currentPage = Number(params?.page) || 1;

  const buildUrl = (page: number, limit: number | string) => {
    const searchParams = new URLSearchParams();
    if (params?.startDate) searchParams.append('startDate', params.startDate);
    if (params?.endDate) searchParams.append('endDate', params.endDate);
    if (params?.date) searchParams.append('date', params.date);
    if (params?.employeeId) searchParams.append('employeeId', params.employeeId);
    if (params?.type) searchParams.append('type', params.type);
    searchParams.append('limit', String(limit));
    searchParams.append('page', String(page));
    return `/api/attendance?${searchParams.toString()}`;
  };

  // Nếu người dùng yêu cầu 1 trang cụ thể (kèm page parameter cụ thể mà không fetchAllPages)
  if (params?.page !== undefined && !params.fetchAllPages) {
    const res = await apiFetch(buildUrl(currentPage, pageSize));
    if (res.success && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  }

  // Tự động phân trang tiếp để nạp trọn vẹn lịch sử không bị ngắt ở 5000 bản ghi
  const allRecords: AttendanceRecord[] = [];
  while (true) {
    const res = await apiFetch(buildUrl(currentPage, pageSize));
    if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
      break;
    }
    allRecords.push(...res.data);
    // Nếu số lượng bản ghi trả về ít hơn pageSize, đã hết dữ liệu
    if (res.data.length < pageSize || (!params?.fetchAllPages && allRecords.length >= 50000)) {
      break;
    }
    currentPage++;
  }

  return allRecords;
}

/**
 * Lấy lịch sử log raw theo từng trang để hiển thị phân trang UI.
 */
export async function fetchAttendancePaginatedApi(
  params?: FetchAttendanceParams
): Promise<PaginatedAttendanceResponse> {
  const pageSize = Number(params?.limit) || 50;
  const page = Number(params?.page) || 1;

  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.date) searchParams.append('date', params.date);
  if (params?.employeeId) searchParams.append('employeeId', params.employeeId);
  if (params?.type) searchParams.append('type', params.type);
  searchParams.append('limit', String(pageSize));
  searchParams.append('page', String(page));

  const res = await apiFetch(`/api/attendance?${searchParams.toString()}`);
  const records: AttendanceRecord[] = res.success && Array.isArray(res.data) ? res.data : [];

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
