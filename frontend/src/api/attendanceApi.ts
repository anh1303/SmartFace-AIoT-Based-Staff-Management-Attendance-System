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
}

export async function fetchAttendanceApi(params?: FetchAttendanceParams): Promise<AttendanceRecord[]> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) searchParams.append('startDate', params.startDate);
  if (params?.endDate) searchParams.append('endDate', params.endDate);
  if (params?.date) searchParams.append('date', params.date);
  if (params?.employeeId) searchParams.append('employeeId', params.employeeId);
  if (params?.type) searchParams.append('type', params.type);
  if (params?.limit !== undefined) {
    searchParams.append('limit', String(params.limit));
  } else {
    searchParams.append('limit', '5000');
  }
  if (params?.page) searchParams.append('page', String(params.page));

  const queryStr = searchParams.toString();
  const url = queryStr ? `/api/attendance?${queryStr}` : '/api/attendance?limit=5000';
  const res = await apiFetch(url);
  if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'Không tải được lịch sử chấm công');
  if (params?.limit !== undefined || params?.page !== undefined) return res.data;
  const result = [...res.data];
  let page = 2;
  while (result.length % 5000 === 0 && result.length > 0) {
    searchParams.set('page', String(page++));
    const next = await apiFetch(`/api/attendance?${searchParams}`);
    if (!next.success || !Array.isArray(next.data)) throw new Error('Không tải đủ lịch sử chấm công');
    result.push(...next.data);
    if (next.data.length < 5000) break;
  }
  return result;
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
