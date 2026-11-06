import { getDashboardShifts } from '../shifts/public.js';
import { getEmployeeScope, getEmployeesForReporting, type EmployeeActor } from '../employees/public.js';
import { determinePunctuality, getDashboardAttendanceLogs } from '../attendance/public.js';
import { formatShiftTime, formatVNDateISO, formatVNTime, vnDay } from '../../common/utils.js';
import type {
  TodayDashboardResponseDto,
  DashboardShiftGroupDto,
  ShiftLiveStatusCode,
  DashboardDepartmentProgressDto,
  DashboardEmployeeShiftItemDto,
  DashboardRecentLogDto,
  DashboardAlertsDto,
} from './dashboard.dto.js';

const DEPARTMENT_COLORS = [
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#f43f5e',
  '#f59e0b',
  '#06b6d4',
  '#6366f1',
  '#ec4899',
];

export async function getTodayDashboard(
  actor?: EmployeeActor
): Promise<TodayDashboardResponseDto> {
  const now = new Date();
  const todayStr = vnDay(now);

  const vnTimeStr = formatVNTime(now);
  const currentHHMM = vnTimeStr.slice(0, 5);
  const [curH, curM] = currentHHMM.split(':').map(Number);
  const nowMinutes = curH * 60 + curM;

  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const parts = todayStr.split('-');
  const d = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00+07:00`);
  const dayName = dayNames[d.getDay()];
  const dateFormatted = `${dayName}, ${parts[2]}/${parts[1]}/${parts[0]}`;

  const startUtc = new Date(`${todayStr}T00:00:00+07:00`);
  const endUtc = new Date(`${todayStr}T23:59:59.999+07:00`);

  // RBAC scope
  const employeeScope = await getEmployeeScope(actor);

  // 1. Employees in scope
  const employees = await getEmployeesForReporting(employeeScope);

  const employeeIds = employees.map((e) => e.id);
  const empIdToInfoMap = new Map(
    employees.map((e) => [
      e.id,
      {
        code: e.employee_code,
        name: e.full_name,
        avatar: e.avatar_url,
        dept: e.department?.name || 'Chưa phân phòng',
      },
    ])
  );

  // 2. Query today shifts and attendance logs in parallel
  const [todayShifts, todayLogs] = await Promise.all([
    getDashboardShifts(employeeIds, todayStr),
    getDashboardAttendanceLogs(employeeIds, startUtc, endUtc),
  ]);

  const shiftsByEmployee = new Map<string, typeof todayShifts>();
  for (const shift of todayShifts) {
    const shifts = shiftsByEmployee.get(shift.employee_id) || [];
    shifts.push({
      ...shift,
      start_time: shift.start_time ?? shift.work_shifts?.start_time,
      end_time: shift.end_time ?? shift.work_shifts?.end_time,
    });
    shiftsByEmployee.set(shift.employee_id, shifts);
  }
  const punctualityOf = (log: (typeof todayLogs)[number]) => determinePunctuality(
    log.type, log.event_time, shiftsByEmployee.get(log.employee_id)
  );

  // Scheduled employees
  const scheduledEmpIds = new Set(todayShifts.map((s) => s.employee_id));
  const workingEmployeesCount = scheduledEmpIds.size;
  const totalEmployees = employees.length;

  // Checkins & Checkouts
  const firstArrivals = new Map<string, (typeof todayLogs)[0]>();
  for (const log of [...todayLogs].sort((a, b) => +a.event_time - +b.event_time)) {
    if (log.type === 'CHECK_IN' && log.status === 'VALID' && !firstArrivals.has(log.employee_id)) {
      firstArrivals.set(log.employee_id, log);
    }
  }
  const todayCheckIns = [...firstArrivals.values()];
  const todayCheckOuts = todayLogs.filter(
    (a) => a.type === 'CHECK_OUT' || a.type === 'TAN_CA'
  );
  const checkInCount = todayCheckIns.length;
  const checkOutCount = todayCheckOuts.length;

  // Currently working count (latest punch per employee is CHECK_IN)
  const empLatestPunchMap = new Map<string, (typeof todayLogs)[0]>();
  // todayLogs is sorted descending, so iterate reverse to let later punches overwrite earlier ones
  for (let i = todayLogs.length - 1; i >= 0; i--) {
    const log = todayLogs[i];
    empLatestPunchMap.set(log.employee_id, log);
  }
  let currentlyWorkingCount = 0;
  empLatestPunchMap.forEach((lastPunch) => {
    if (lastPunch.type === 'CHECK_IN') {
      currentlyWorkingCount += 1;
    }
  });

  // Checked in unique employee IDs
  const checkedInEmpIds = new Set(todayCheckIns.map((a) => a.employee_id));

  // Punctuality statistics
  const scheduledCheckIns = todayCheckIns.filter((log) => scheduledEmpIds.has(log.employee_id));
  const earlyDepartureEmpIds = new Set(todayLogs.filter(
    (log) => log.status === 'VALID' && log.type === 'CHECK_OUT' && punctualityOf(log) === 'EARLY_LEAVE'
  ).map((log) => log.employee_id));
  const lateCount = scheduledCheckIns.filter(
    (log) => punctualityOf(log) === 'LATE' || earlyDepartureEmpIds.has(log.employee_id)
  ).length;
  const onTimeCount = scheduledCheckIns.length - lateCount;
  const notCheckedInCount = workingEmployeesCount - scheduledCheckIns.length;
  const totalPunctuality = onTimeCount + lateCount + notCheckedInCount;

  const onTimePct =
    totalPunctuality > 0 ? Math.round((onTimeCount / totalPunctuality) * 100) : 0;
  const latePct =
    totalPunctuality > 0 ? Math.round((lateCount / totalPunctuality) * 100) : 0;
  const notCheckedInPct =
    totalPunctuality > 0 ? Math.max(0, 100 - onTimePct - latePct) : 0;

  const donutData =
    totalPunctuality === 0
      ? [{ name: 'Chưa có dữ liệu', value: 1, color: '#334155' }]
      : [
        { name: 'Đúng giờ', value: onTimeCount, color: '#10b981' },
        { name: 'Đi muộn / về sớm', value: lateCount, color: '#f43f5e' },
        { name: 'Chưa check-in', value: notCheckedInCount, color: '#8b5cf6' },
      ];

  // Helper for live shift status: Sắp diễn ra | Đang diễn ra | Đã kết thúc
  const getShiftLiveStatus = (
    startTime: string,
    endTime: string
  ): { code: ShiftLiveStatusCode; label: string; style: string } => {
    const isOvernight = endTime < startTime;

    if (isOvernight) {
      if (currentHHMM >= startTime || currentHHMM < endTime) {
        return {
          code: 'ONGOING',
          label: 'Đang diễn ra',
          style:
            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      }
      return {
        code: 'UPCOMING',
        label: 'Sắp diễn ra',
        style:
          'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
      };
    } else {
      if (currentHHMM < startTime) {
        return {
          code: 'UPCOMING',
          label: 'Sắp diễn ra',
          style:
            'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      }
      if (currentHHMM >= startTime && currentHHMM <= endTime) {
        return {
          code: 'ONGOING',
          label: 'Đang diễn ra',
          style:
            'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      }
      return {
        code: 'ENDED',
        label: 'Đã kết thúc',
        style:
          'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/20',
      };
    }
  };

  // Shifts grouping from DB
  let shifts: DashboardShiftGroupDto[] = [];
  {
    const shiftGroupMap = new Map<string, DashboardShiftGroupDto>();
    todayShifts.forEach((s) => {
      const startTime = formatShiftTime(
        s.start_time ?? s.work_shifts?.start_time,
        '08:00'
      );
      const endTime = formatShiftTime(
        s.end_time ?? s.work_shifts?.end_time,
        '17:00'
      );
      const shiftType = s.shift_type || 'OFFICE_HOURS';
      const key = `${shiftType}_${startTime}_${endTime}`;

      if (!shiftGroupMap.has(key)) {
        let name = 'Ca làm việc';
        if (shiftType === 'OFFICE_HOURS') {
          name = 'Ca hành chính';
        } else if (shiftType === 'MORNING') {
          name = 'Ca sáng';
        } else if (shiftType === 'AFTERNOON') {
          name = 'Ca chiều';
        } else if (shiftType === 'NIGHT') {
          name = 'Ca đêm';
        } else if (s.work_shifts?.shift_name) {
          name = s.work_shifts.shift_name;
        }

        shiftGroupMap.set(key, {
          id: key,
          name,
          timeRange: `${startTime} - ${endTime}`,
          startTime,
          endTime,
          count: 0,
          type: shiftType,
          liveStatus: getShiftLiveStatus(startTime, endTime),
        });
      }
      shiftGroupMap.get(key)!.count += 1;
    });

    shifts = Array.from(shiftGroupMap.values()).sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
  }

  // Department attendance progress
  const deptMap = new Map<string, { total: number; scheduled: number }>();
  employees.forEach((emp) => {
    const dept = emp.department?.name?.trim() || 'Chưa phân phòng';
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { total: 0, scheduled: 0 });
    }
    const stat = deptMap.get(dept)!;
    stat.total += 1;
    if (scheduledEmpIds.has(emp.id)) {
      stat.scheduled += 1;
    }
  });

  const departmentProgress: DashboardDepartmentProgressDto[] = Array.from(
    deptMap.entries()
  )
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, data], idx) => ({
      name,
      scheduled: data.scheduled,
      total: data.total,
      pct: data.total > 0 ? Math.round((data.scheduled / data.total) * 100) : 0,
      color: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
    }));

  // Employee Shift List
  const empShiftNameMap = new Map<string, string>();
  todayShifts.forEach((s) => {
    const name =
      s.shift_type === 'MORNING'
        ? 'Ca sáng'
        : s.shift_type === 'AFTERNOON'
          ? 'Ca chiều'
          : s.shift_type === 'OFFICE_HOURS'
            ? 'Ca HC'
            : 'Có ca';
    empShiftNameMap.set(s.employee_id, name);
  });

  const employeeList: DashboardEmployeeShiftItemDto[] = employees
    .map((emp) => {
      const hasShift = scheduledEmpIds.has(emp.id);
      return {
        employeeId: emp.employee_code,
        fullName: emp.full_name,
        avatar: emp.avatar_url,
        department: emp.department?.name || 'Chung',
        hasShift,
        shiftName: empShiftNameMap.get(emp.id) || (hasShift ? 'Có ca' : 'Nghỉ ca'),
      };
    })
    .sort((a, b) => {
      if (a.hasShift !== b.hasShift) return a.hasShift ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'vi');
    });

  // Recent attendance logs (10 latest)
  const recentLogsRaw = todayLogs.slice(0, 10);
  const recentLogs: DashboardRecentLogDto[] = recentLogsRaw.map((att) => {
    const empInfo = empIdToInfoMap.get(att.employee_id);
    const punctuality = punctualityOf(att);
    let statusLabel = 'Đúng giờ';
    let statusStyle = 'bg-[#0c2a20] text-emerald-400 border border-emerald-800/80';

    if (att.status === 'INVALID') {
      statusLabel = 'Không hợp lệ';
      statusStyle = 'bg-[#38101a] text-rose-400 border border-rose-800/80';
    } else if (att.status === 'FLAGGED') {
      statusLabel = 'Cần xác minh';
      statusStyle = 'bg-[#2a1d0c] text-amber-400 border border-amber-800/80';
    } else if (punctuality === 'LATE') {
      statusLabel = 'Đi muộn';
      statusStyle = 'bg-[#38101a] text-rose-400 border border-rose-800/80';
    } else if (punctuality === 'EARLY_LEAVE') {
      statusLabel = 'Về sớm';
      statusStyle = 'bg-[#38101a] text-rose-400 border border-rose-800/80';
    } else if (punctuality === 'UNRECORDED') {
      statusLabel = 'Chưa ghi nhận';
      statusStyle = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
    }

    return {
      attendance_id: att.id.toString(),
      employee_id: empInfo?.code || att.employee_id,
      employee_name: empInfo?.name || empInfo?.code || att.employee_id,
      avatar: empInfo?.avatar || null,
      type: att.type,
      timestamp: att.event_time.toISOString(),
      device_id: att.device_info || null,
      verification_score: att.verification_score,
      status: att.status,
      statusInfo: {
        label: statusLabel,
        style: statusStyle,
      },
    };
  });

  // Alerts
  const overdueEmployees: string[] = [];
  todayShifts.forEach((s) => {
    const startTime = formatShiftTime(
      s.start_time ?? s.work_shifts?.start_time,
      '08:00'
    );
    if (startTime <= currentHHMM && !checkedInEmpIds.has(s.employee_id)) {
      const emp = empIdToInfoMap.get(s.employee_id);
      if (emp) overdueEmployees.push(emp.code);
    }
  });

  let upcomingShiftNotice: DashboardAlertsDto['upcomingShiftNotice'] = null;
  const uniqueStartTimes = Array.from(
    new Set(
      todayShifts.map((s) =>
        formatShiftTime(s.start_time ?? s.work_shifts?.start_time, '08:00')
      )
    )
  ).sort();

  for (const st of uniqueStartTimes) {
    const [h, m] = st.split(':').map(Number);
    const shiftMinutes = h * 60 + m;
    const diff = shiftMinutes - nowMinutes;
    if (diff > 0 && diff <= 60) {
      const sample = todayShifts.find((s) => {
        const sTime = formatShiftTime(
          s.start_time ?? s.work_shifts?.start_time,
          '08:00'
        );
        return sTime === st;
      });
      const shiftName =
        sample?.shift_type === 'MORNING'
          ? 'Ca sáng'
          : sample?.shift_type === 'AFTERNOON'
            ? 'Ca chiều'
            : sample?.shift_type === 'NIGHT'
              ? 'Ca đêm'
              : 'Ca hành chính';
      upcomingShiftNotice = {
        name: shiftName,
        time: st,
        minutesLeft: diff,
      };
      break;
    }
  }

  return {
    dateStr: todayStr,
    dateFormatted,
    kpis: {
      workingEmployeesCount,
      totalEmployees,
      checkInCount,
      currentlyWorkingCount,
      checkOutCount,
    },
    punctuality: {
      onTimeCount,
      lateCount,
      notCheckedInCount,
      onTimePct,
      latePct,
      notCheckedInPct,
      donutData,
    },
    shifts,
    departmentProgress,
    employeeList,
    recentLogs,
    alerts: {
      overdueEmployees: Array.from(new Set(overdueEmployees)),
      upcomingShiftNotice,
    },
  };
}
