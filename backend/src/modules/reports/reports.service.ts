import { prisma } from '../../config/database.js';
import { getEmployeeScope, type EmployeeActor } from '../employees/public.js';
import { formatVNDateISO, vnDay } from '../../common/utils.js';
import type {
  MonthlyReportResponseDto,
  DepartmentSummaryDto,
  EmployeeLeaderboardDto,
  DailyPunctualityPointDto,
} from './reports.dto.js';

const DEPARTMENT_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ec4899',
  '#06b6d4',
  '#6366f1',
];

export async function getMonthlyReport(
  periodInput?: string,
  actor?: EmployeeActor
): Promise<MonthlyReportResponseDto> {
  const selectedPeriod =
    periodInput && /^\d{4}-\d{2}$/.test(periodInput)
      ? periodInput
      : vnDay(new Date()).slice(0, 7);

  const [yearStr, monthStr] = selectedPeriod.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const daysInMonth = new Date(year, month, 0).getDate();

  const startDate = `${selectedPeriod}-01`;
  const endDate = `${selectedPeriod}-${String(daysInMonth).padStart(2, '0')}`;
  const startUtc = new Date(`${startDate}T00:00:00+07:00`);
  const endUtc = new Date(`${endDate}T23:59:59.999+07:00`);

  // RBAC scope for actor
  const employeeScope = await getEmployeeScope(actor);

  // Query employees within scope
  const employees = await prisma.employee.findMany({
    where: {
      AND: [employeeScope, { status: 'ACTIVE' }],
    },
    include: {
      department: true,
      position: true,
    },
    orderBy: [{ departmentId: 'asc' }, { employee_code: 'asc' }],
  });

  const employeeIds = employees.map((e) => e.id);

  // Departments list
  const activeDepartments = await prisma.department.findMany({
    where: { is_active: true },
    orderBy: { name: 'asc' },
  });

  const departmentNamesSet = new Set<string>();
  activeDepartments.forEach((d) => departmentNamesSet.add(d.name));
  employees.forEach((e) => {
    if (e.department?.name) departmentNamesSet.add(e.department.name);
  });
  const departmentList = Array.from(departmentNamesSet).sort();

  // Query raw logs, summaries, shifts, payroll in parallel
  const [attendanceLogs, dailySummaries, monthShifts, payrollRecords, distinctPeriods] =
    await Promise.all([
      // 1. Attendance logs in month
      prisma.attendance_logs.findMany({
        where: {
          employee_id: { in: employeeIds },
          event_time: {
            gte: startUtc,
            lte: endUtc,
          },
        },
        select: {
          id: true,
          employee_id: true,
          event_time: true,
          type: true,
          method: true,
          verification_score: true,
          status: true,
        },
        orderBy: { event_time: 'asc' },
      }),

      // 2. Daily summaries
      prisma.daily_attendance_summary.findMany({
        where: {
          employee_id: { in: employeeIds },
          work_date: {
            gte: new Date(`${startDate}T00:00:00Z`),
            lte: new Date(`${endDate}T00:00:00Z`),
          },
        },
        select: {
          employee_id: true,
          work_date: true,
          total_working_hours: true,
          late_early: true,
          overtime: true,
          attendance_status: true,
          review_status: true,
        },
      }),

      // 3. Employee shifts
      prisma.employee_shifts.findMany({
        where: {
          employee_id: { in: employeeIds },
          work_date: {
            gte: new Date(`${startDate}T00:00:00Z`),
            lte: new Date(`${endDate}T00:00:00Z`),
          },
          shift_type: { not: 'OFF' },
        },
        select: {
          employee_id: true,
          work_date: true,
          shift_type: true,
        },
      }),

      // 4. Payroll records for this period
      prisma.payrollRecord.findMany({
        where: {
          employeeId: { in: employeeIds },
          payroll_period: selectedPeriod,
        },
        select: {
          employeeId: true,
          net_salary: true,
          status: true,
        },
      }),

      // 5. Distinct periods for available period selector
      prisma.payrollRecord.findMany({
        select: { payroll_period: true },
        distinct: ['payroll_period'],
        orderBy: { payroll_period: 'desc' },
      }),
    ]);

  // Available periods list
  const periodSet = new Set<string>([
    selectedPeriod,
    ...distinctPeriods.map((p) => p.payroll_period).filter(Boolean),
  ]);
  const availablePeriods = Array.from(periodSet).sort().reverse();

  // 1. BIOMETRICS STATS
  const getNormalizedScore = (score: number | null | undefined): number => {
    if (score === null || score === undefined) return NaN;
    if (score > 1) return score / 100;
    return score;
  };

  const faceLogs = attendanceLogs.filter((a) => a.method === 'FACE');
  const fpLogs = attendanceLogs.filter((a) => a.method === 'FINGERPRINT');
  const totalBiometrics = faceLogs.length + fpLogs.length;

  const faceGt95 = faceLogs.filter((a) => getNormalizedScore(a.verification_score) >= 0.95).length;
  const faceMid = faceLogs.filter((a) => {
    const s = getNormalizedScore(a.verification_score);
    return s >= 0.8 && s < 0.95;
  }).length;
  const faceLt80 = faceLogs.filter((a) => getNormalizedScore(a.verification_score) < 0.8).length;

  const fpGt95 = fpLogs.filter((a) => getNormalizedScore(a.verification_score) >= 0.95).length;
  const fpMid = fpLogs.filter((a) => {
    const s = getNormalizedScore(a.verification_score);
    return s >= 0.8 && s < 0.95;
  }).length;
  const fpLt80 = fpLogs.filter((a) => getNormalizedScore(a.verification_score) < 0.8).length;

  const biometrics = {
    face: {
      totalCount: faceLogs.length,
      pctOfTotal: totalBiometrics > 0 ? Math.round((faceLogs.length / totalBiometrics) * 100) : 0,
      tierGt95: faceGt95,
      tierMid: faceMid,
      tierLt80: faceLt80,
    },
    fingerprint: {
      totalCount: fpLogs.length,
      pctOfTotal: totalBiometrics > 0 ? Math.round((fpLogs.length / totalBiometrics) * 100) : 0,
      tierGt95: fpGt95,
      tierMid: fpMid,
      tierLt80: fpLt80,
    },
  };

  // 2. DAILY PUNCTUALITY TIMELINE
  const dailyPunctuality: DailyPunctualityPointDto[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = String(d).padStart(2, '0');
    const dateKey = `${selectedPeriod}-${dayStr}`;
    const dayLogs = attendanceLogs.filter((a) => formatVNDateISO(a.event_time) === dateKey);
    const total = dayLogs.length;
    const onTime = dayLogs.filter((a) => a.status === 'VALID').length;
    const rate = total > 0 ? Number(((onTime / total) * 100).toFixed(1)) : undefined;

    dailyPunctuality.push({
      day: dayStr,
      rate,
      total,
      onTime,
    });
  }

  // 3. DEPARTMENT BREAKDOWN
  const departments: DepartmentSummaryDto[] = departmentList.map((deptName, idx) => {
    const deptEmployees = employees.filter(
      (e) => (e.department?.name || 'Chung') === deptName
    );
    const deptEmpIds = new Set(deptEmployees.map((e) => e.id));

    const deptAttendance = attendanceLogs.filter((a) => deptEmpIds.has(a.employee_id));
    const totalPunches = deptAttendance.length;
    const onTimePunches = deptAttendance.filter((a) => a.status === 'VALID').length;
    const onTimeRate =
      totalPunches > 0 ? Number(((onTimePunches / totalPunches) * 100).toFixed(1)) : 0;

    const deptSummaries = dailySummaries.filter((s) => deptEmpIds.has(s.employee_id));
    const totalOvertimeHours = deptSummaries.reduce(
      (acc, s) => acc + Number(s.overtime || 0),
      0
    );
    const totalLateEarlyHours = deptSummaries.reduce(
      (acc, s) => acc + Number(s.late_early || 0),
      0
    );
    const unexcusedAbsenceCount = deptSummaries.filter(
      (s) => s.attendance_status === 'ABSENT'
    ).length;

    // Payroll per department
    const deptPayroll = payrollRecords.filter((p) => deptEmpIds.has(p.employeeId));
    const deptPayrollSum = deptPayroll.reduce((acc, p) => acc + Number(p.net_salary || 0), 0);

    return {
      departmentName: deptName,
      color: DEPARTMENT_COLORS[idx % DEPARTMENT_COLORS.length],
      employeeCount: deptEmployees.length,
      totalPunches,
      totalOvertimeHours,
      totalLateEarlyHours,
      unexcusedAbsenceCount,
      onTimeRate,
      totalSalary: deptPayrollSum,
    };
  });

  // 4. EMPLOYEE LEADERBOARD
  const rawLeaderboard = employees.map((emp) => {
    const empLogs = attendanceLogs.filter((a) => a.employee_id === emp.id);
    const punchCount = empLogs.length;
    const onTimeCount = empLogs.filter((a) => a.status === 'VALID').length;
    const onTimeRate =
      punchCount > 0 ? Number(((onTimeCount / punchCount) * 100).toFixed(1)) : 0;

    const empSummaries = dailySummaries.filter((s) => s.employee_id === emp.id);
    const overtimeHours = empSummaries.reduce((acc, s) => acc + Number(s.overtime || 0), 0);
    const lateEarlyHours = empSummaries.reduce((acc, s) => acc + Number(s.late_early || 0), 0);
    const absenceCount = empSummaries.filter((s) => s.attendance_status === 'ABSENT').length;

    const empPayroll = payrollRecords.find((p) => p.employeeId === emp.id);
    const salary = empPayroll ? Number(empPayroll.net_salary) : null;

    return {
      rank: 1,
      employeeId: emp.employee_code,
      fullName: emp.full_name,
      avatar: emp.avatar_url,
      department: emp.department?.name || 'Chung',
      punchCount,
      overtimeHours,
      lateEarlyHours,
      absenceCount,
      onTimeRate,
      salary,
    };
  });

  rawLeaderboard.sort((a, b) => {
    if (!a.punchCount || !b.punchCount) return Number(b.punchCount > 0) - Number(a.punchCount > 0);
    if (b.onTimeRate !== a.onTimeRate) return b.onTimeRate - a.onTimeRate;
    if (b.punchCount !== a.punchCount) return b.punchCount - a.punchCount;
    return a.absenceCount - b.absenceCount;
  });

  const leaderboard: EmployeeLeaderboardDto[] = rawLeaderboard.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  // 5. SUMMARY KPIS
  const totalPunches = attendanceLogs.length;
  const onTimePunches = attendanceLogs.filter((a) => a.status === 'VALID').length;
  const onTimeRate =
    totalPunches > 0 ? Number(((onTimePunches / totalPunches) * 100).toFixed(1)) : 0;

  const totalOvertimeHours = dailySummaries.reduce(
    (acc, s) => acc + Number(s.overtime || 0),
    0
  );
  const totalLateEarlyHours = dailySummaries.reduce(
    (acc, s) => acc + Number(s.late_early || 0),
    0
  );

  // Unexcused absences across month
  const unexcusedAbsenceCount = dailySummaries.filter((s) => s.attendance_status === 'ABSENT').length;
  const totalSalary = payrollRecords.reduce((acc, p) => acc + Number(p.net_salary ?? 0), 0);

  const summary = {
    departmentCount: departmentList.length,
    employeeCount: employees.length,
    totalShiftsCount: monthShifts.length,
    totalOvertimeHours,
    totalLateEarlyHours,
    unexcusedAbsenceCount,
    onTimePunches,
    totalPunches,
    onTimeRate,
    totalSalary,
    selectedPeriod,
  };

  return {
    selectedPeriod,
    availablePeriods,
    summary,
    biometrics,
    dailyPunctuality,
    departments,
    leaderboard,
  };
}
