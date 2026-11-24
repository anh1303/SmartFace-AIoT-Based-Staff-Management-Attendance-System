import { apiFetch } from '../../../api/client';
import type { WorkShift } from '../types';
import { submitAndWait } from '../../operations';

export async function submitScheduleBatch(assignments: unknown[]) {
  return submitAndWait('/api/shifts/batch', { assignments });
}
export async function submitScheduleCopy(command: unknown) {
  return submitAndWait('/api/shifts/copy-week', command);
}

export interface FetchShiftsParams {
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}

export async function fetchShiftsApi(params?: FetchShiftsParams): Promise<WorkShift[]> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set('startDate', params.startDate);
  if (params?.endDate) query.set('endDate', params.endDate);
  if (params?.employeeId) query.set('employeeId', params.employeeId);
  const qs = query.toString();
  const res = await apiFetch(qs ? `/api/shifts?${qs}` : '/api/shifts');
  if (!res.success || !Array.isArray(res.data)) throw new Error(res.message || 'Không tải được lịch làm việc');
  return res.data as WorkShift[];
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
      expectedVersion: shiftData.shift_id ? shiftData.version ?? 1 : null,
    }),
  });
  if (!res.success || !res.data?.shift_id) throw new Error(res.message || 'Chưa lưu được lịch làm việc');
  return res.data as WorkShift;
}
