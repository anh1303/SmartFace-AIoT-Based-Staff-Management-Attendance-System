import { useMemo } from 'react';
import { Employee, WorkShift, AttendanceRecord } from '../../../types';
import { formatVNDate, formatVNTime } from '../../../utils/dateUtils';
import {
  calculateRawLateEarlySec,
  calculateRawInitialOTSec,
  roundTo30Minutes,
  formatSecondsToHHMMSS,
} from '../timeUtils';

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
}

export function useAttendancePairs(
  employees: Employee[],
  workShifts: WorkShift[],
  attendance: AttendanceRecord[],
  selectedDate: string,
  searchTerm: string,
  statusFilter: string,
  customOvertimeMap: Record<string, number>,
  customLateEarlyMap: Record<string, number>
): AttendancePairItem[] {
  return useMemo(() => {
    const targetShifts = workShifts.filter(shift => {
      if (shift.shift_type === 'OFF') return false;
      if (selectedDate !== '' && shift.date !== selectedDate) return false;
      return true;
    });

    const pairs: (AttendancePairItem | null)[] = targetShifts.map(empShift => {
      const emp = employees.find(e => e.employee_id === empShift.employee_id);
      if (!emp) return null;

      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matches =
          emp.full_name.toLowerCase().includes(term) ||
          emp.employee_id.toLowerCase().includes(term) ||
          emp.department.toLowerCase().includes(term);
        if (!matches) return null;
      }

      const shiftDate = empShift.date;
      const shiftName =
        empShift.note ||
        (empShift.shift_type === 'MORNING'
          ? 'Ca sáng'
          : empShift.shift_type === 'AFTERNOON'
          ? 'Ca chiều'
          : 'Hành chính');
      const shiftTimeRange = `${empShift.start_time} – ${empShift.end_time}`;

      const empLogs = attendance.filter(log => {
        if (log.employee_id !== emp.employee_id) return false;
        const vnDateParts = formatVNDate(log.timestamp).split('/');
        const logDateStr = vnDateParts.length === 3 ? `${vnDateParts[2]}-${vnDateParts[1]}-${vnDateParts[0]}` : '';
        return logDateStr === shiftDate;
      });

      const checkInLog = empLogs.find(l => l.type === 'CHECK_IN') || empLogs[0];
      const checkOutLog =
        empLogs.find(l => l.type === 'CHECK_OUT' || l.type === 'TAN_CA') ||
        (empLogs.length > 1 ? empLogs[1] : undefined);

      const checkInTime = checkInLog ? formatVNTime(checkInLog.timestamp) : '--:--:--';
      const checkOutTime = checkOutLog ? formatVNTime(checkOutLog.timestamp) : '--:--:--';

      const hasCheckedIn = checkInLog !== undefined && checkInTime !== '--:--:--';
      const hasCheckedOut = checkOutLog !== undefined && checkOutTime !== '--:--:--';

      const isCheckInFace = checkInLog?.method === 'FACE';
      const isCheckOutFace = checkOutLog?.method === 'FACE';

      const initialLateEarlySec = hasCheckedIn
        ? calculateRawLateEarlySec(
            { start_time: empShift.start_time, end_time: empShift.end_time },
            checkInLog?.timestamp || (checkInLog ? checkInTime : undefined),
            checkOutLog?.timestamp || (checkOutLog ? checkOutTime : undefined)
          )
        : 0;

      const initialOTSec = hasCheckedOut
        ? calculateRawInitialOTSec(
            { start_time: empShift.start_time, end_time: empShift.end_time },
            checkInLog?.timestamp || (checkInLog ? checkInTime : undefined),
            checkOutLog?.timestamp || (checkOutLog ? checkOutTime : undefined)
          )
        : 0;

      const summaryKey = `${emp.employee_id}_${shiftDate}`;

      const currentLateEarlySec =
        customLateEarlyMap[summaryKey] !== undefined
          ? customLateEarlyMap[summaryKey]
          : roundTo30Minutes(initialLateEarlySec);
      const lateEarlyStr = formatSecondsToHHMMSS(currentLateEarlySec);

      const currentOTSec =
        customOvertimeMap[summaryKey] !== undefined
          ? customOvertimeMap[summaryKey]
          : roundTo30Minutes(initialOTSec);
      const overtimeStr = hasCheckedOut ? formatSecondsToHHMMSS(currentOTSec) : '--:--:--';

      const normalizeDeviceId = (id?: string | null, isFace?: boolean, isCheckIn?: boolean) => {
        if (id) {
          const lower = id.toLowerCase();
          if (lower.includes('fp-gate') || lower.includes('gate-02') || lower.includes('fp-02')) return 'Fingerprint-02';
          if (lower.includes('fp-01') || lower.includes('gate-01')) return 'Fingerprint-01';
          if (lower.includes('cam-04') || lower.includes('cam-05')) return isCheckIn ? 'FaceCam-01' : 'FaceCam-02';
          return id;
        }
        if (isFace) {
          return isCheckIn ? 'FaceCam-01' : 'FaceCam-02';
        }
        return isCheckIn ? 'Fingerprint-01' : 'Fingerprint-02';
      };

      const checkInRow: AttendanceEventItem = {
        id: `${emp.employee_id}-${shiftDate}-in`,
        type: 'CHECK_IN',
        label: 'Vào Ca',
        time: checkInTime,
        isFace: isCheckInFace,
        methodLabel: isCheckInFace ? 'Face-id' : 'Vân tay',
        device_id: normalizeDeviceId(checkInLog?.device_id, isCheckInFace, true),
        score: checkInLog?.verification_score ?? (checkInLog ? 0.99 : null),
        status: checkInLog
          ? checkInLog.punctuality || (checkInLog.status === 'VALID' ? 'ON_TIME' : checkInLog.status)
          : 'UNRECORDED',
        statusText: checkInLog
          ? (checkInLog.punctuality || (checkInLog.status === 'VALID' ? 'ON_TIME' : checkInLog.status)) === 'LATE'
            ? 'Đi muộn'
            : 'Đúng giờ'
          : 'Chưa điểm danh',
      };

      const outPunc = checkOutLog
        ? checkOutLog.punctuality || (checkOutLog.status === 'VALID' ? 'ON_TIME' : checkOutLog.status)
        : null;
      const checkOutRow: AttendanceEventItem = {
        id: `${emp.employee_id}-${shiftDate}-out`,
        type: 'CHECK_OUT',
        label: 'Hết ca',
        time: checkOutTime,
        isFace: isCheckOutFace,
        methodLabel: isCheckOutFace ? 'Face-id' : 'Vân tay',
        device_id: normalizeDeviceId(checkOutLog?.device_id, isCheckOutFace, false),
        score: checkOutLog?.verification_score ?? (checkOutLog ? 0.80 : null),
        status: checkOutLog ? outPunc || 'VALID' : checkInLog ? 'WORKING' : 'UNRECORDED',
        statusText: checkOutLog
          ? outPunc === 'EARLY_LEAVE'
            ? 'Về sớm'
            : 'Đúng giờ'
          : checkInLog
          ? 'Đang làm'
          : 'Chưa điểm danh',
      };

      return {
        employee: emp,
        shift: {
          name: shiftName,
          timeRange: shiftTimeRange,
          start_time: empShift.start_time,
          end_time: empShift.end_time,
          date: shiftDate,
        },
        events: [checkInRow, checkOutRow],
        hasCheckedIn,
        hasCheckedOut,
        initialLateEarlySec,
        currentLateEarlySec,
        lateEarlyStr,
        initialOTSec,
        currentOTSec,
        overtimeStr,
        date: shiftDate,
      };
    });

    const validPairs = pairs.filter((item): item is AttendancePairItem => item !== null);

    if (statusFilter === 'ALL') return validPairs;
    return validPairs.filter(item =>
      item.events.some(
        ev => ev.status === statusFilter || (statusFilter === 'ON_TIME' && ev.status === 'ON_TIME')
      )
    );
  }, [
    employees,
    workShifts,
    attendance,
    selectedDate,
    searchTerm,
    statusFilter,
    customOvertimeMap,
    customLateEarlyMap,
  ]);
}
