import { useMemo } from 'react';
import { Employee, WorkShift, AttendanceRecord } from '../../../types';
import { formatVNDateISO, formatVNTime } from '../../../utils/dateUtils';
import { formatSecondsToHHMMSS } from '../../../utils/timeUtils';
import { BackendAttendanceSummaryItem } from './useAttendanceSummaries';

export interface AttendanceIntervalItem {
  inTime: string | null;
  outTime: string | null;
  durationSeconds: number;
  durationStr: string;
  isValid: boolean;
  method?: string;
  device_id?: string;
  score?: number | null;
}

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
    shift_type?: string;
  };
  events: AttendanceEventItem[];
  validIntervals: AttendanceIntervalItem[];
  rawEvents: AttendanceEventItem[];
  hasCheckedIn: boolean;
  hasCheckedOut: boolean;
  isOffDay: boolean;
  isUnassigned: boolean;
  initialLateEarlySec: number;
  currentLateEarlySec: number;
  lateEarlyStr: string;
  initialOTSec: number;
  currentOTSec: number;
  overtimeStr: string;
  date: string;
  workingHours: number;
  regularHours: number;
  rawWorkSeconds: number;
  rawWorkSecondsStr: string;
  approvedOtHours: number;
  proposedOtHours: number;
  pendingOtHours: number;
  needsReview: boolean;
  reviewReason: string | null;
  policyVersion: string | null;
  isLegacyNoPolicy: boolean;
}

export function useAttendancePairs(
  employees: Employee[],
  workShifts: WorkShift[],
  attendance: AttendanceRecord[],
  startDate: string,
  endDate: string,
  searchTerm: string,
  statusFilter: string,
  customOvertimeMap: Record<string, number>,
  customLateEarlyMap: Record<string, number>,
  departmentFilter: string = 'ALL',
  positionFilter: string = 'ALL',
  workingHoursMap?: Record<string, number>,
  summaryMap?: Record<string, BackendAttendanceSummaryItem>
): AttendancePairItem[] {
  return useMemo(() => {
    // 1. Lọc danh sách ca làm việc trong khoảng ngày [startDate, endDate]
    // QUAN TRỌNG: KHÔNG loại bỏ ca 'OFF' để Manager có thể theo dõi và duyệt OT ngày nghỉ
    const targetShifts = workShifts.filter(shift => {
      if (startDate && shift.date < startDate) return false;
      if (endDate && shift.date > endDate) return false;
      return true;
    });

    // Tạo tập hợp các cặp (employee_id, date) đã có ca
    const scheduledShiftKeys = new Set<string>();
    targetShifts.forEach(s => {
      scheduledShiftKeys.add(`${s.employee_id}_${s.date}`);
    });

    // 2. Tìm thêm những ngày nhân viên CHƯA PHÂN CA nhưng có bản ghi chấm công / summary từ backend
    const unassignedEntries: Array<{
      employee_id: string;
      date: string;
      shift_type: string;
      start_time: string;
      end_time: string;
    }> = [];

    if (summaryMap) {
      Object.values(summaryMap).forEach(sum => {
        if (startDate && sum.date < startDate) return;
        if (endDate && sum.date > endDate) return;
        const key = `${sum.employee_id}_${sum.date}`;
        const uuidKey = `${sum.employee_uuid}_${sum.date}`;
        if (!scheduledShiftKeys.has(key) && !scheduledShiftKeys.has(uuidKey)) {
          scheduledShiftKeys.add(key);
          unassignedEntries.push({
            employee_id: sum.employee_id,
            date: sum.date,
            shift_type: 'UNASSIGNED',
            start_time: '--:--',
            end_time: '--:--',
          });
        }
      });
    }

    const allShiftEntries = [
      ...targetShifts.map(s => ({
        employee_id: s.employee_id,
        date: s.date,
        shift_type: s.shift_type,
        start_time: s.start_time,
        end_time: s.end_time,
      })),
      ...unassignedEntries,
    ];

    const pairs: (AttendancePairItem | null)[] = allShiftEntries.map(empShift => {
      const emp = employees.find(
        e => e.employee_id === empShift.employee_id || (e.id && e.id === empShift.employee_id)
      );
      if (!emp) return null;

      if (departmentFilter && departmentFilter !== 'ALL' && emp.department?.toLowerCase() !== departmentFilter.toLowerCase()) {
        return null;
      }

      if (positionFilter && positionFilter !== 'ALL' && emp.position?.toLowerCase() !== positionFilter.toLowerCase()) {
        return null;
      }

      const term = searchTerm.toLowerCase().trim();
      if (term) {
        const matches =
          emp.full_name.toLowerCase().includes(term) ||
          emp.employee_id.toLowerCase().includes(term) ||
          emp.department.toLowerCase().includes(term);
        if (!matches) return null;
      }

      const shiftDate = empShift.date;
      const isOffDay = empShift.shift_type === 'OFF';
      const isUnassigned = empShift.shift_type === 'UNASSIGNED';

      const shiftName = isOffDay
        ? 'Nghỉ (OFF)'
        : isUnassigned
          ? 'Chưa phân ca'
          : empShift.shift_type === 'MORNING'
            ? 'Ca sáng'
            : empShift.shift_type === 'AFTERNOON'
              ? 'Ca chiều'
              : 'Ca hành chính';

      const shiftTimeRange = isOffDay || isUnassigned
        ? isOffDay ? 'Nghỉ tuần / Nghỉ lễ' : '--:-- – --:--'
        : `${empShift.start_time} – ${empShift.end_time}`;

      const summaryKey = `${emp.employee_id}_${shiftDate}`;
      const fallbackKey = emp.id ? `${emp.id}_${shiftDate}` : '';
      const summary = summaryMap?.[summaryKey] || (fallbackKey ? summaryMap?.[fallbackKey] : undefined);

      // 3. Số giờ làm việc lấy trực tiếp từ summary backend (không tự tạo công 9h khi có sự kiện lẻ)
      const regularHours = isOffDay
        ? 0
        : (summary?.regular_hours ?? (summary?.total_working_hours ?? (workingHoursMap?.[summaryKey] ?? (fallbackKey ? workingHoursMap?.[fallbackKey] ?? 0 : 0))));
      const workingHours = regularHours;

      // Giây làm việc gốc (raw_work_seconds)
      const rawWorkSeconds = summary?.raw_work_seconds ?? 0;
      const rawWorkSecondsStr = formatSecondsToHHMMSS(rawWorkSeconds);

      // Đi trễ / về sớm từ backend
      const currentLateEarlySec =
        customLateEarlyMap[summaryKey] !== undefined
          ? customLateEarlyMap[summaryKey]
          : (fallbackKey && customLateEarlyMap[fallbackKey] !== undefined
            ? customLateEarlyMap[fallbackKey]
            : Math.round((Number(summary?.late_early) || 0) * 3600));
      const lateEarlyStr = formatSecondsToHHMMSS(currentLateEarlySec);
      const initialLateEarlySec = currentLateEarlySec;

      // Giờ tăng ca (OT) đã duyệt và đề xuất
      const approvedOtHours = summary?.approved_overtime_hours ?? (Number(summary?.overtime) || 0);
      const proposedOtHours = summary?.proposed_overtime_hours ?? approvedOtHours;
      const pendingOtHours = summary?.pending_overtime_hours ?? Math.max(0, proposedOtHours - approvedOtHours);

      const currentOTSec =
        customOvertimeMap[summaryKey] !== undefined
          ? customOvertimeMap[summaryKey]
          : (fallbackKey && customOvertimeMap[fallbackKey] !== undefined
            ? customOvertimeMap[fallbackKey]
            : Math.round(approvedOtHours * 3600));
      const overtimeStr = formatSecondsToHHMMSS(currentOTSec);
      const initialOTSec = currentOTSec;

      // Cờ rà soát và phiên bản chính sách
      const needsReview = summary?.needs_review ?? false;
      const reviewReason = summary?.review_reason ?? null;
      const policyVersion = summary?.policy_version ?? null;
      const isLegacyNoPolicy = summary ? summary.is_legacy_no_policy : false;

      // 4. Lấy danh sách log thực tế của nhân viên trong ngày (sắp xếp tăng dần theo thời gian)
      const empLogs = attendance
        .filter(log => {
          const isEmpMatch = log.employee_id === emp.employee_id || (emp.id && log.employee_id === emp.id);
          if (!isEmpMatch) return false;
          const logDateStr = formatVNDateISO(log.timestamp);
          return logDateStr === shiftDate;
        })
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Danh sách tất cả raw events (bao gồm cả sự kiện lẻ)
      const rawEvents: AttendanceEventItem[] = empLogs.map((log, idx) => {
        const isFace = log.method === 'FACE';
        const methodLabel = isFace
          ? 'Face-id'
          : log.method === 'FINGERPRINT'
            ? 'Vân tay'
            : log.method === 'RFID'
              ? 'Thẻ từ'
              : log.method === 'MANUAL'
                ? 'Thủ công'
                : (log.method || 'UNRECORDED');

        return {
          id: `${emp.employee_id}-${shiftDate}-raw-${idx}-${log.attendance_id || idx}`,
          type: log.type === 'CHECK_OUT' || log.type === 'TAN_CA' ? 'CHECK_OUT' : 'CHECK_IN',
          label: log.type === 'CHECK_OUT' || log.type === 'TAN_CA' ? 'Hết ca' : 'Vào Ca',
          time: formatVNTime(log.timestamp),
          isFace,
          methodLabel,
          device_id: log.device_id || '--',
          score: log.verification_score !== undefined && log.verification_score !== null ? log.verification_score : null,
          status: log.punctuality || (log.status === 'VALID' ? 'ON_TIME' : log.status),
          statusText: log.punctuality === 'LATE'
            ? 'Đi muộn'
            : log.punctuality === 'EARLY_LEAVE'
              ? 'Về sớm'
              : log.status === 'VALID' ? 'Đúng giờ' : log.status,
        };
      });

      // 5. Bóc tách từng khoảng IN -> OUT hợp lệ
      const validIntervals: AttendanceIntervalItem[] = [];
      if (summary?.pairs && summary.pairs.length > 0) {
        summary.pairs.forEach(p => {
          validIntervals.push({
            inTime: p.in_time,
            outTime: p.out_time,
            durationSeconds: p.duration_seconds,
            durationStr: formatSecondsToHHMMSS(p.duration_seconds),
            isValid: p.is_valid,
            method: p.method,
            device_id: p.device_info || '--',
            score: p.score ?? null,
          });
        });
      } else {
        // Tự động phân tách cặp theo thứ tự xuất hiện nếu backend chưa có summary.pairs
        let i = 0;
        while (i < empLogs.length) {
          const cur = empLogs[i];
          if (cur.type === 'CHECK_IN') {
            const next = empLogs[i + 1];
            if (next && (next.type === 'CHECK_OUT' || next.type === 'TAN_CA')) {
              const durSec = Math.max(0, Math.round((new Date(next.timestamp).getTime() - new Date(cur.timestamp).getTime()) / 1000));
              validIntervals.push({
                inTime: formatVNTime(cur.timestamp),
                outTime: formatVNTime(next.timestamp),
                durationSeconds: durSec,
                durationStr: formatSecondsToHHMMSS(durSec),
                isValid: true,
                method: cur.method,
                device_id: cur.device_id || '--',
                score: cur.verification_score ?? null,
              });
              i += 2;
            } else {
              validIntervals.push({
                inTime: formatVNTime(cur.timestamp),
                outTime: null,
                durationSeconds: 0,
                durationStr: '--:--:--',
                isValid: false,
                method: cur.method,
                device_id: cur.device_id || '--',
                score: cur.verification_score ?? null,
              });
              i++;
            }
          } else {
            validIntervals.push({
              inTime: null,
              outTime: formatVNTime(cur.timestamp),
              durationSeconds: 0,
              durationStr: '--:--:--',
              isValid: false,
              method: cur.method,
              device_id: cur.device_id || '--',
              score: cur.verification_score ?? null,
            });
            i++;
          }
        }
      }

      // Check-in đầu tiên và Check-out cuối cùng để hiển thị dòng tóm tắt
      const checkInLog = empLogs.find(l => l.type === 'CHECK_IN') || (empLogs.length > 0 ? empLogs[0] : undefined);
      const checkOutLog = empLogs
        .slice()
        .reverse()
        .find(l => (l.type === 'CHECK_OUT' || l.type === 'TAN_CA') && l !== checkInLog);

      const checkInTime = checkInLog ? formatVNTime(checkInLog.timestamp) : '--:--:--';
      const checkOutTime = checkOutLog ? formatVNTime(checkOutLog.timestamp) : '--:--:--';

      const hasCheckedIn = checkInLog !== undefined && checkInTime !== '--:--:--';
      const hasCheckedOut = checkOutLog !== undefined && checkOutTime !== '--:--:--';

      const isCheckInFace = checkInLog?.method === 'FACE';
      const isCheckOutFace = checkOutLog?.method === 'FACE';

      const checkInRow: AttendanceEventItem = {
        id: `${emp.employee_id}-${shiftDate}-in`,
        type: 'CHECK_IN',
        label: 'Vào Ca',
        time: checkInTime,
        isFace: isCheckInFace,
        methodLabel: checkInLog ? (isCheckInFace ? 'Face-id' : 'Vân tay') : 'UNRECORDED',
        device_id: checkInLog?.device_id || '--',
        score: checkInLog?.verification_score ?? null,
        status: checkInLog
          ? checkInLog.punctuality || (checkInLog.status === 'VALID' ? 'ON_TIME' : checkInLog.status)
          : isOffDay ? 'OFF' : 'UNRECORDED',
        statusText: checkInLog
          ? (checkInLog.punctuality || (checkInLog.status === 'VALID' ? 'ON_TIME' : checkInLog.status)) === 'LATE'
            ? 'Đi muộn'
            : 'Đúng giờ'
          : isOffDay ? 'Nghỉ (OFF)' : 'Chưa điểm danh',
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
        methodLabel: checkOutLog ? (isCheckOutFace ? 'Face-id' : 'Vân tay') : 'UNRECORDED',
        device_id: checkOutLog?.device_id || '--',
        score: checkOutLog?.verification_score ?? null,
        status: checkOutLog ? outPunc || 'VALID' : checkInLog ? 'WORKING' : (isOffDay ? 'OFF' : 'UNRECORDED'),
        statusText: checkOutLog
          ? outPunc === 'EARLY_LEAVE'
            ? 'Về sớm'
            : 'Đúng giờ'
          : checkInLog
            ? 'Đang làm'
            : isOffDay ? 'Nghỉ (OFF)' : 'Chưa điểm danh',
      };

      return {
        employee: emp,
        shift: {
          name: shiftName,
          timeRange: shiftTimeRange,
          start_time: empShift.start_time,
          end_time: empShift.end_time,
          date: shiftDate,
          shift_type: empShift.shift_type,
        },
        events: [checkInRow, checkOutRow],
        validIntervals,
        rawEvents,
        hasCheckedIn,
        hasCheckedOut,
        isOffDay,
        isUnassigned,
        initialLateEarlySec,
        currentLateEarlySec,
        lateEarlyStr,
        initialOTSec,
        currentOTSec,
        overtimeStr,
        date: shiftDate,
        workingHours,
        regularHours,
        rawWorkSeconds,
        rawWorkSecondsStr,
        approvedOtHours,
        proposedOtHours,
        pendingOtHours,
        needsReview,
        reviewReason,
        policyVersion,
        isLegacyNoPolicy,
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
    startDate,
    endDate,
    searchTerm,
    statusFilter,
    customOvertimeMap,
    customLateEarlyMap,
    departmentFilter,
    positionFilter,
    workingHoursMap,
    summaryMap,
  ]);
}
