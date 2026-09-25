import { apiFetch } from './client';
import { WorkShift } from '../types';

export async function fetchShiftsApi(): Promise<WorkShift[]> {
  const res = await apiFetch('/api/shifts');
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
}

export async function assignShiftApi(shiftData: Omit<WorkShift, 'shift_id'> & { shift_id?: string }) {
  const res = await apiFetch('/api/shifts', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: shiftData.employee_id,
      work_date: shiftData.date,
      shift_type: shiftData.shift_type,
      start_time: shiftData.start_time,
      end_time: shiftData.end_time,
      note: shiftData.note,
    }),
  });
  return res.data;
}
