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
  inId?: string;
  outId?: string;
  counted?: boolean;
  regularSeconds?: number;
  overtimeSeconds?: number;
  creditedRegularSeconds?: number;
  creditReason?: string;
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
  rawStatus?: string;
  timestamp?: string;
  pairingReason?: string;
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
  status: string;
  isAbsent: boolean;
  isShiftEnded?: boolean;
  initialLateEarlySec: number | null;
  currentLateEarlySec: number;
  lateEarlyStr: string;
  initialOTSec: number | null;
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
  reasonLabels?: Record<string, string>;
  policyVersion: string | null;
  isLegacyNoPolicy: boolean;
  overtimeStatus: string;
  candidateHours: number;
  pairIntervals: string[];
  hasPairData?: boolean;
  reviewStatus?: 'NONE' | 'PENDING' | 'APPROVED';
  isApproved?: boolean;
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
  workingHoursMapOrSummaries?: Record<string, number> | Record<string, any>,
  maybeSummaryMap?: Record<string, BackendAttendanceSummaryItem>
): AttendancePairItem[] {
  return useMemo(() => {
    const isFirstParamSummary = Boolean(
      workingHoursMapOrSummaries &&
      Object.values(workingHoursMapOrSummaries).some(v => v !== null && typeof v === 'object')
    );

    const summaryMap: Record<string, any> = isFirstParamSummary
      ? (workingHoursMapOrSummaries as Record<string, any>)
      : (maybeSummaryMap || {});

    const workingHoursMap: Record<string, number> = isFirstParamSummary
      ? {}
      : ((workingHoursMapOrSummaries as Record<string, number>) || {});
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
          const details = sum.calculation_details;
          const hasScheduled = details && Number(details.scheduledShiftSeconds || 0) > 0 && details.scheduledStart && details.scheduledEnd && !details.off;
          let shiftType = 'UNASSIGNED';
          let startTime = '--:--';
          let endTime = '--:--';
          if (hasScheduled) {
            startTime = formatVNTime(details.scheduledStart).slice(0, 5);
            endTime = formatVNTime(details.scheduledEnd).slice(0, 5);
            if (startTime === '08:00' && endTime === '12:00') shiftType = 'MORNING';
            else if (startTime === '13:00' && endTime === '17:00') shiftType = 'AFTERNOON';
            else if (startTime === '08:00' && endTime === '17:00') shiftType = 'OFFICE_HOURS';
            else shiftType = 'CUSTOM';
          }
          unassignedEntries.push({
            employee_id: sum.employee_id,
            date: sum.date,
            shift_type: shiftType,
            start_time: startTime,
            end_time: endTime,
          });
        }
      });
    }

    const allClaimedEventIds = new Set<string>();
    if (summaryMap) {
      Object.values(summaryMap).forEach((sum: any) => {
        if (!sum?.calculation_details) return;
        const pairs = sum.calculation_details.pairs || [];
        pairs.forEach((p: any) => {
          if (p.inId) allClaimedEventIds.add(String(p.inId));
          if (p.outId) allClaimedEventIds.add(String(p.outId));
        });
        const events = sum.calculation_details.events || [];
        events.forEach((ev: any) => {
          if (ev.id) allClaimedEventIds.add(String(ev.id));
        });
      });
    }

    const isPlausibleOvernightCheckout = (empId: string, empUuid: string | undefined, log: AttendanceRecord, dateStr: string) => {
      const prevD = new Date(`${dateStr}T00:00:00Z`);
      prevD.setUTCDate(prevD.getUTCDate() - 1);
      const prevDateStr = prevD.toISOString().slice(0, 10);
      const prevShift = workShifts.find(s => 
        (s.employee_id === empId || (empUuid && s.employee_id === empUuid)) &&
        s.date === prevDateStr &&
        s.end_time < s.start_time
      );
      if (!prevShift) return false;

      // Check if yesterday's shift already has a claimed or paired checkout
      const prevSummary = summaryMap?.[`${empId}_${prevDateStr}`] || (empUuid ? summaryMap?.[`${empUuid}_${prevDateStr}`] : undefined);
      if (prevSummary) {
        const hasClaimedCheckout = (prevSummary.calculation_details?.pairs || []).some((p: any) => Boolean(p.outId)) || Boolean(prevSummary.last_check_out);
        if (hasClaimedCheckout) {
          // Yesterday's overnight shift already has a paired checkout.
          // This checkout cannot be the overnight shift checkout.
          return false;
        }
      }

      const logTime = (log as any).time || (log.timestamp ? formatVNTime(log.timestamp) : '');
      if (!logTime || logTime === '--:--:--') return false;
      const [logH, logM] = logTime.split(':').map(Number);
      const logMinutes = (isNaN(logH) ? 0 : logH) * 60 + (isNaN(logM) ? 0 : logM);

      const [endH, endM] = prevShift.end_time.split(':').map(Number);
      const shiftEndMinutes = (isNaN(endH) ? 6 : endH) * 60 + (isNaN(endM) ? 0 : endM);

      const isMorningWindow = logMinutes <= 14 * 60;
      const isWithinShiftEndWindow = logMinutes <= shiftEndMinutes + 6 * 60;

      const hasYesterdayCheckIn = attendance.some(a =>
        (a.employee_id === empId || (empUuid && a.employee_id === empUuid)) &&
        a.type === 'CHECK_IN' &&
        formatVNDateISO(a.timestamp) === prevDateStr
      );

      if (!isMorningWindow || !isWithinShiftEndWindow || !hasYesterdayCheckIn) {
        return false;
      }

      // If there are multiple morning checkouts without a summary, only the earliest one
      // is the plausible overnight checkout candidate; later checkouts must not be swallowed.
      const earlierMorningCheckout = attendance.find(a => {
        if ((a.employee_id !== empId && (!empUuid || a.employee_id !== empUuid))) return false;
        if (a.type !== 'CHECK_OUT' && a.type !== 'TAN_CA') return false;
        if (formatVNDateISO(a.timestamp) !== dateStr) return false;
        const aId = String(a.id || a.attendance_id || '');
        const logId = String(log.id || log.attendance_id || '');
        if (aId && logId && aId === logId) return false;
        return +new Date(a.timestamp) < +new Date(log.timestamp);
      });

      if (earlierMorningCheckout) {
        return false;
      }

      return true;
    };

    for (const log of attendance) {
      const logId = String(log.id || log.attendance_id || '');
      if (logId && allClaimedEventIds.has(logId)) continue;
      const emp = employees.find(e => e.employee_id === log.employee_id || e.id === log.employee_id);
      if (!emp) continue;
      const date = formatVNDateISO(log.timestamp);
      if (startDate && date < startDate || endDate && date > endDate) continue;
      if (log.type === 'CHECK_OUT' && isPlausibleOvernightCheckout(emp.employee_id, emp.id, log, date)) continue;
      if (scheduledShiftKeys.has(`${emp.employee_id}_${date}`) || emp.id && scheduledShiftKeys.has(`${emp.id}_${date}`)) continue;
      scheduledShiftKeys.add(`${emp.employee_id}_${date}`);
      unassignedEntries.push({employee_id:emp.employee_id,date,shift_type:'UNASSIGNED',start_time:'--:--',end_time:'--:--'});
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
      const summaryKey = `${emp.employee_id}_${shiftDate}`;
      const fallbackKey = emp.id ? `${emp.id}_${shiftDate}` : '';
      const summary = summaryMap?.[summaryKey] || (fallbackKey ? summaryMap?.[fallbackKey] : undefined);

      const details = summary?.calculation_details;
      const hasScheduledFromSummary = details && Number(details.scheduledShiftSeconds || 0) > 0 && details.scheduledStart && details.scheduledEnd && !details.off;

      const effectiveShiftType = (empShift.shift_type === 'UNASSIGNED' && hasScheduledFromSummary)
        ? (formatVNTime(details.scheduledStart).slice(0, 5) === '08:00' && formatVNTime(details.scheduledEnd).slice(0, 5) === '12:00'
            ? 'MORNING'
            : formatVNTime(details.scheduledStart).slice(0, 5) === '13:00' && formatVNTime(details.scheduledEnd).slice(0, 5) === '17:00'
              ? 'AFTERNOON'
              : formatVNTime(details.scheduledStart).slice(0, 5) === '08:00' && formatVNTime(details.scheduledEnd).slice(0, 5) === '17:00'
                ? 'OFFICE_HOURS'
                : 'CUSTOM')
        : empShift.shift_type;

      const effectiveStartTime = (empShift.shift_type === 'UNASSIGNED' && hasScheduledFromSummary)
        ? formatVNTime(details.scheduledStart).slice(0, 5)
        : empShift.start_time;

      const effectiveEndTime = (empShift.shift_type === 'UNASSIGNED' && hasScheduledFromSummary)
        ? formatVNTime(details.scheduledEnd).slice(0, 5)
        : empShift.end_time;

      const isOffDay = effectiveShiftType === 'OFF' || details?.off === true;
      const isUnassigned = effectiveShiftType === 'UNASSIGNED';

      const shiftName = isOffDay
        ? 'Ngày OFF'
        : isUnassigned
          ? 'Chưa phân ca'
          : effectiveEndTime < effectiveStartTime ? 'Ca qua đêm' : effectiveShiftType === 'MORNING'
            ? 'Ca sáng'
            : effectiveShiftType === 'AFTERNOON'
              ? 'Ca chiều'
              : effectiveShiftType === 'OFFICE_HOURS'
                ? 'Ca hành chính'
                : 'Ca làm việc';

      const shiftTimeRange = isOffDay || isUnassigned
        ? isOffDay ? 'Nghỉ tuần / Nghỉ lễ' : '--:-- – --:--'
        : `${effectiveStartTime} – ${effectiveEndTime}`;

      // 3. Số giờ làm việc lấy trực tiếp từ summary backend (không tự tạo công 9h khi có sự kiện lẻ)
      const regularHours = isOffDay
        ? 0
        : (summary?.total_working_hours !== undefined
            ? Number(summary.total_working_hours)
            : (summary?.regular_hours !== undefined
                ? Number(summary.regular_hours)
                : (workingHoursMap?.[summaryKey] ?? (fallbackKey ? workingHoursMap?.[fallbackKey] ?? 0 : 0))));
      const workingHours = isOffDay ? 0 : Number(summary?.total_working_hours ?? regularHours);

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
      const initialLateEarlySec = summary?.late_early_seconds != null ? Number(summary.late_early_seconds) : null;

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
      const initialOTSec = summary?.overtime_seconds != null ? Number(summary.overtime_seconds) : null;

      // Cờ rà soát và phiên bản chính sách
      const needsReview = summary?.requires_review ?? summary?.needs_review ?? false;
      const rawReviewReason: string | null = summary?.review_reason ?? null;
      const reviewReason = isUnassigned
        ? (rawReviewReason
            ? rawReviewReason
                .split(',')
                .filter(Boolean)
                .map((r: string) => (r === 'UNDER_MINIMUM_SHIFT' || r === 'UNDER_HALF_SHIFT' ? 'NO_SHIFT' : r))
                .join(',') || (needsReview ? 'NO_SHIFT' : null)
            : (needsReview ? 'NO_SHIFT' : null))
        : rawReviewReason;
      const policyVersion = summary?.policy_version ?? null;
      const isLegacyNoPolicy = summary ? summary.is_legacy_no_policy : false;

      // 4. Lấy danh sách log thực tế của nhân viên trong ngày (sắp xếp tăng dần theo thời gian)
      const sourceEvents = summary?.calculation_details?.events;
      const savedLogs: AttendanceRecord[] = Array.isArray(sourceEvents) ? sourceEvents.map((ev: any) => {
        const raw = attendance.find(log => (log.id || log.attendance_id) === ev.id);
        return { ...raw, id: ev.id, attendance_id: ev.id, employee_id: emp.employee_id, type: ev.type,
          timestamp: ev.time, status: ev.status, method: ev.method || raw?.method || 'MANUAL',
          device_id: ev.device_info || raw?.device_id || '--', verification_score: ev.verification_score ?? raw?.verification_score ?? null };
      }) : attendance.filter(log => (log.employee_id === emp.employee_id || (emp.id && log.employee_id === emp.id)) && formatVNDateISO(log.timestamp) === shiftDate)
        .sort((a,b) => +new Date(a.timestamp) - +new Date(b.timestamp));
      const foreignIds = new Set(Object.values(summaryMap).filter((s: any) => s && s.date !== shiftDate && (s.employee_id === emp.employee_id || s.employee_uuid === emp.id))
        .flatMap((s: any) => (s.calculation_details?.pairs || []).flatMap((p: any) => [p.inId, p.outId])));
      const savedIds = new Set(savedLogs.map(l => l.id || l.attendance_id));
      const empLogs = [...savedLogs, ...attendance.filter(l => (l.employee_id === emp.employee_id || l.employee_id === emp.id)
        && formatVNDateISO(l.timestamp) === shiftDate && !savedIds.has(l.id || l.attendance_id) && !foreignIds.has(l.id || l.attendance_id))]
        .filter(l => !foreignIds.has(l.id || l.attendance_id))
        .sort((a,b) => +new Date(a.timestamp) - +new Date(b.timestamp));

      const isNoShift = isOffDay || isUnassigned;

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

        const isEventUnrecorded = isNoShift || log.punctuality === 'UNRECORDED';

        return {
          id: log.id || log.attendance_id,
          timestamp: log.timestamp,
          rawStatus: log.raw_status || log.status,
          pairingReason: summary?.calculation_details?.ignored?.find((i: any) => i.id === (log.id || log.attendance_id))?.reason,
          type: log.type === 'CHECK_OUT' || log.type === 'TAN_CA' ? 'CHECK_OUT' : 'CHECK_IN',
          label: log.type === 'CHECK_OUT' || log.type === 'TAN_CA' ? 'Check out' : 'Check in',
          time: formatVNTime(log.timestamp),
          isFace,
          methodLabel,
          device_id: log.device_id || '--',
          score: log.verification_score !== undefined && log.verification_score !== null ? log.verification_score : null,
          status: isEventUnrecorded
            ? 'UNRECORDED'
            : log.punctuality === 'LATE'
              ? 'LATE'
              : log.punctuality === 'EARLY_LEAVE'
                ? 'EARLY_LEAVE'
                : 'ON_TIME',
          statusText: isEventUnrecorded
            ? 'UNRECORDED'
            : log.punctuality === 'LATE'
              ? 'Đi muộn'
              : log.punctuality === 'EARLY_LEAVE'
                ? 'Về sớm'
                : 'Đúng giờ',
        };
      });

      // 5. Bóc tách từng khoảng IN -> OUT hợp lệ
      const policyPairs: Array<{ inId: string; outId: string; start: string; end: string; counted?: boolean; regular_seconds?: number; overtime_seconds?: number; credited_regular_seconds?: number; credit_reason?: string }> = summary?.calculation_details?.pairs || [];
      const validIntervals: AttendanceIntervalItem[] = policyPairs.map(p => ({
        inTime: `${formatVNDateISO(p.start)} ${formatVNTime(p.start)}`, outTime: `${formatVNDateISO(p.end)} ${formatVNTime(p.end)}`,
        durationSeconds: (+new Date(p.end) - +new Date(p.start)) / 1000,
        durationStr: formatSecondsToHHMMSS((+new Date(p.end) - +new Date(p.start)) / 1000), isValid: true,
        inId: p.inId, outId: p.outId, counted: p.counted, regularSeconds: p.regular_seconds, overtimeSeconds: p.overtime_seconds,
        creditedRegularSeconds: p.credited_regular_seconds,
        creditReason: isUnassigned && (p.credit_reason === 'UNDER_MINIMUM_SHIFT' || p.credit_reason === 'UNDER_HALF_SHIFT') ? 'NO_SHIFT' : p.credit_reason,
      }));
      // Show a pending valid check-in or unpaired check-out without treating it as a completed work interval.
      const ignoredIds = new Set((summary?.calculation_details?.ignored || []).map((event: any) => event.id));
      const pendingCheckIn = !summary?.first_check_in && policyPairs.length === 0
        ? (empLogs.find(l => l.type === 'CHECK_IN' && l.status === 'VALID' && !ignoredIds.has(l.id || l.attendance_id))
           || empLogs.find(l => l.type === 'CHECK_IN'))
        : undefined;
      const pendingCheckOut = !summary?.last_check_out && policyPairs.length === 0
        ? empLogs.filter(l => l.type === 'CHECK_OUT' || l.type === 'TAN_CA').at(-1)
        : undefined;

      const checkInLog = summary?.first_check_in
        ? empLogs.find(l => l.type === 'CHECK_IN' && +new Date(l.timestamp) === +new Date(summary.first_check_in))
        : pendingCheckIn;
      const checkOutLog = summary?.last_check_out
        ? empLogs.find(l => (l.type === 'CHECK_OUT' || l.type === 'TAN_CA') && +new Date(l.timestamp) === +new Date(summary.last_check_out))
        : pendingCheckOut;

      const checkInTime = summary?.first_check_in
        ? formatVNTime(summary.first_check_in)
        : pendingCheckIn
          ? formatVNTime(pendingCheckIn.timestamp)
          : '--:--:--';
      const checkOutTime = summary?.last_check_out
        ? formatVNTime(summary.last_check_out)
        : pendingCheckOut
          ? formatVNTime(pendingCheckOut.timestamp)
          : '--:--:--';
      const hasCheckedIn = checkInTime !== '--:--:--';
      const hasCheckedOut = checkOutTime !== '--:--:--';

      const isCheckInFace = checkInLog?.method === 'FACE';
      const isCheckOutFace = checkOutLog?.method === 'FACE';

      const checkInRow: AttendanceEventItem = {
        id: `${emp.employee_id}-${shiftDate}-in`,
        type: 'CHECK_IN',
        label: 'Check in',
        time: checkInTime,
        isFace: isCheckInFace,
        methodLabel: checkInLog ? (isCheckInFace ? 'Face-id' : 'Vân tay') : 'UNRECORDED',
        device_id: checkInLog?.device_id || '--',
        score: checkInLog?.verification_score ?? null,
        status: isNoShift
          ? 'UNRECORDED'
          : checkInLog
            ? (['LATE', 'LATE_AND_EARLY'].includes(summary?.status)
                ? 'LATE'
                : checkInLog.punctuality === 'UNRECORDED'
                  ? 'UNRECORDED'
                  : 'ON_TIME')
            : 'UNRECORDED',
        statusText: isNoShift
          ? (checkInLog ? 'UNRECORDED' : '--')
          : checkInLog
            ? (['LATE', 'LATE_AND_EARLY'].includes(summary?.status)
                ? 'Đi muộn'
                : checkInLog.punctuality === 'UNRECORDED'
                  ? 'UNRECORDED'
                  : 'Đúng giờ')
            : '--',
      };

      const outPunc = ['EARLY_LEAVE', 'LATE_AND_EARLY'].includes(summary?.status) ? 'EARLY_LEAVE' : checkOutLog?.punctuality || 'ON_TIME';

      const checkOutRow: AttendanceEventItem = {
        id: `${emp.employee_id}-${shiftDate}-out`,
        type: 'CHECK_OUT',
        label: 'Check out',
        time: checkOutTime,
        isFace: isCheckOutFace,
        methodLabel: checkOutLog ? (isCheckOutFace ? 'Face-id' : 'Vân tay') : 'UNRECORDED',
        device_id: checkOutLog?.device_id || '--',
        score: checkOutLog?.verification_score ?? null,
        status: isNoShift
          ? 'UNRECORDED'
          : checkOutLog
            ? (outPunc === 'EARLY_LEAVE'
                ? 'EARLY_LEAVE'
                : outPunc === 'UNRECORDED'
                  ? 'UNRECORDED'
                  : 'ON_TIME')
            : 'UNRECORDED',
        statusText: isNoShift
          ? (checkOutLog ? 'UNRECORDED' : '--')
          : checkOutLog
            ? (outPunc === 'EARLY_LEAVE'
                ? 'Về sớm'
                : outPunc === 'UNRECORDED'
                  ? 'UNRECORDED'
                  : 'Đúng giờ')
            : '--',
      };

      const status = summary?.status || (isOffDay ? 'OFF' : isUnassigned ? 'NO_SHIFT' : 'SCHEDULED');
      const isAbsent = summary?.is_absent ?? (status === 'ABSENT' || Boolean((summary?.calculation_details as any)?.absenceCandidate));
      const isShiftEnded = summary?.is_shift_ended ?? (status === 'ABSENT');

      return {
        employee: emp,
        shift: {
          name: shiftName,
          timeRange: shiftTimeRange,
          start_time: effectiveStartTime,
          end_time: effectiveEndTime,
          date: shiftDate,
          shift_type: effectiveShiftType,
        },
        events: [checkInRow, checkOutRow],
        validIntervals,
        rawEvents,
        hasCheckedIn,
        hasCheckedOut,
        isOffDay,
        isUnassigned,
        status,
        isAbsent,
        isShiftEnded,
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
        reasonLabels: { ...summary?.reason_labels, NO_SHIFT: 'Chưa phân ca' },
        policyVersion,
        isLegacyNoPolicy,
        overtimeStatus: (summary as any)?.overtime_status || 'NONE',
        candidateHours: Number((summary as any)?.overtime_candidate_hours || 0),
        hasPairData: Array.isArray(summary?.calculation_details?.pairs),
        pairIntervals: Array.isArray((summary as any)?.calculation_details?.pairs)
          ? (summary as any).calculation_details.pairs.map((p: any) => `${formatVNTime(p.start)} → ${formatVNTime(p.end)}`)
          : [],
        reviewStatus: (summary as any)?.review_status || 'NONE',
        isApproved: (summary as any)?.review_status === 'APPROVED',
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
    workingHoursMapOrSummaries,
    maybeSummaryMap,
  ]);
}
