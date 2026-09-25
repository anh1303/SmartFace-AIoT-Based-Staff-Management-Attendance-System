import { apiFetch } from './client';
import { AttendanceRecord } from '../types';

export async function fetchAttendanceApi(): Promise<AttendanceRecord[]> {
  const res = await apiFetch('/api/attendance');
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

export async function addAttendanceApi(record: Omit<AttendanceRecord, 'attendance_id'>) {
  const endpoint = record.type === 'CHECK_IN' ? 'check-in' : 'check-out';
  const res = await apiFetch(`/api/attendance/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      employeeId: record.employee_id,
      device_info: record.device_id,
      method: record.method,
    }),
  });
  return res.data;
}
