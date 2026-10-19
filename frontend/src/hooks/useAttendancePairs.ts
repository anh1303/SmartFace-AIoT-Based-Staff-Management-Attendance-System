import type { AttendanceSummary } from '../features/attendance/hooks/useAttendanceSummaries';
import { formatSecondsToHHMMSS } from '../utils/timeUtils';
import { useMemo } from 'react';
import { Employee, WorkShift, AttendanceRecord } from '../types';
import { formatVNTime } from '../utils/dateUtils';
export interface AttendanceEventItem {
  id: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  label: string;
  time: string;
  isFace: boolean;
  methodLabel: string;
  device_id: string;
  score: number | null;
  status: string;
  statusText: string;
}

export interface AttendancePairItem {
  employee: Employee;
  shift: {
    name: string;
    timeRange: string;
    start_time: string;
    end_time: string;
    date: string;
  };
  events: AttendanceEventItem[];
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  initialLateEarlySec: number;
  currentLateEarlySec: number;
  lateEarlyStr: string;
  initialOTSec: number;
  currentOTSec: number;
  overtimeStr: string;
  date: string;
  workingHours: number; overtimeStatus: string; candidateHours: number; reviewReason: string | null; pairIntervals: string[];
}

export function useAttendancePairs(
  employees: Employee[], workShifts: WorkShift[], attendance: AttendanceRecord[],
  startDate: string, endDate: string, searchTerm: string, statusFilter: string,
  _customOvertimeMap: Record<string, number>, _customLateEarlyMap: Record<string, number>,
  departmentFilter = 'ALL', positionFilter = 'ALL', summaries: Record<string, AttendanceSummary> = {}
): AttendancePairItem[] {
  return useMemo(() => {
    const rows = workShifts.map(s => ({ employee_id: s.employee_id, date: s.date, shift: s }));
    for (const summary of Object.values(summaries)) {
      if (!rows.some(r => r.employee_id === summary.employee_id && r.date === summary.date))
        rows.push({ employee_id: summary.employee_id, date: summary.date, shift: undefined as unknown as WorkShift });
    }
    return rows.flatMap(({ employee_id, date, shift }) => {
      if ((startDate && date < startDate) || (endDate && date > endDate)) return [];
      const emp = employees.find(e => e.employee_id === employee_id || e.id === employee_id);
      if (!emp) return [];
      if (departmentFilter !== 'ALL' && emp.department?.toLowerCase() !== departmentFilter.toLowerCase()) return [];
      if (positionFilter !== 'ALL' && emp.position?.toLowerCase() !== positionFilter.toLowerCase()) return [];
      if (searchTerm && !`${emp.full_name} ${emp.employee_id} ${emp.department}`.toLowerCase().includes(searchTerm.toLowerCase().trim())) return [];
      const summary = summaries[`${emp.employee_id}_${date}`];
      const intervals = summary?.calculation_details?.pairs || [];
      const eventRow = (type: 'CHECK_IN' | 'CHECK_OUT', timestamp?: string | null): AttendanceEventItem => {
        const pair = type === 'CHECK_IN' ? intervals[0] : intervals.at(-1);
        const id = type === 'CHECK_IN' ? pair?.inId : pair?.outId;
        const log = id ? attendance.find(l => String(l.id) === id) : undefined;
        const recorded = Boolean(timestamp);
        return { id: `${emp.employee_id}-${date}-${type}`, type,
          label: type === 'CHECK_IN' ? 'Vào ca đầu' : 'Ra ca cuối', time: timestamp ? formatVNTime(timestamp) : '--:--:--',
          isFace: log?.method === 'FACE', methodLabel: recorded ? log?.method || 'Đã ghi nhận' : 'UNRECORDED',
          device_id: log?.device_id || '--', score: log?.verification_score ?? null,
          status: summary?.status || 'UNRECORDED', statusText: summary?.status || 'Chờ tổng hợp' };
      };
      const rawEvents = summary?.calculation_details?.events || [];
      const inTime = summary?.first_check_in || rawEvents.filter(e => e.type === 'CHECK_IN').at(-1)?.time;
      const outTime = summary?.last_check_out || rawEvents.filter(e => e.type === 'CHECK_OUT' || e.type === 'TAN_CA').at(-1)?.time;
      const events = [eventRow('CHECK_IN', inTime), eventRow('CHECK_OUT', outTime)];
      if (statusFilter !== 'ALL' && !events.some(e => e.status === statusFilter || statusFilter === 'ON_TIME' && e.status === 'PRESENT')) return [];
      const currentOTSec = Number(summary?.overtime || 0) * 3600;
      const currentLateEarlySec = Number(summary?.late_early || 0) * 3600;
      return [{ employee: emp, date, shift: {
        name: shift?.shift_type === 'OFF' ? 'Ngày OFF' : !shift ? 'Chưa phân ca' : shift.shift_type === 'MORNING' ? 'Ca sáng' : shift.shift_type === 'AFTERNOON' ? 'Ca chiều' : 'Ca hành chính',
        timeRange: shift ? `${shift.start_time} – ${shift.end_time}` : '--',
        start_time: shift?.start_time || '', end_time: shift?.end_time || '', date },
        events, hasCheckedIn: Boolean(inTime), hasCheckedOut: Boolean(outTime),
        initialLateEarlySec: summary?.late_early_seconds || 0, currentLateEarlySec, lateEarlyStr: formatSecondsToHHMMSS(currentLateEarlySec),
        initialOTSec: summary?.overtime_seconds || 0, currentOTSec, overtimeStr: formatSecondsToHHMMSS(currentOTSec),
        workingHours: Number(summary?.total_working_hours || 0), overtimeStatus: summary?.overtime_status || 'NONE',
        candidateHours: Number(summary?.overtime_candidate_hours || 0), reviewReason: summary?.review_reason || (summary && !summary.policy_version ? 'LEGACY_POLICY_REVIEW' : null),
        pairIntervals: intervals.map(p => `${formatVNTime(p.start)} → ${formatVNTime(p.end)}`),
      }];
    });
  }, [employees, workShifts, attendance, startDate, endDate, searchTerm, statusFilter, departmentFilter, positionFilter, summaries]);
}
