import { useMemo } from 'react';
import { useApp } from '../../../context/AppContext';
import { Employee } from '../../../types';
import { formatVNDateISO } from '../../../utils/dateUtils';

export interface UseEmployeeAttendanceDetailOptions {
  currentEmp: Employee | null;
  startDate?: string;
  endDate?: string;
  attendanceTypeFilter?: string;
  attendanceStatusFilter?: string;
}

export interface AttendanceStats {
  totalLogs: number;
  checkIns: number;
  checkOuts: number;
  workDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  avgConfidence: number;
}

/**
 * Feature Hook: Quản lý chi tiết lịch sử chấm công và tính toán thống kê chấm công của từng nhân viên.
 */
export function useEmployeeAttendanceDetail(options: UseEmployeeAttendanceDetailOptions) {
  const { currentEmp, startDate = '', endDate = '', attendanceTypeFilter = 'ALL', attendanceStatusFilter = 'ALL' } = options;
  const { attendance } = useApp();

  // 1. Filtered Attendance Logs
  const employeeAttendanceLogs = useMemo(() => {
    if (!currentEmp) return [];
    return attendance
      .filter((record) => {
        if (record.employee_id !== currentEmp.employee_id && record.employee_id !== currentEmp.id) {
          return false;
        }
        const recordDate = formatVNDateISO(record.timestamp);
        if (startDate && recordDate < startDate) return false;
        if (endDate && recordDate > endDate) return false;
        if (attendanceTypeFilter === 'CHECK_IN' && record.type !== 'CHECK_IN') return false;
        if (attendanceTypeFilter === 'CHECK_OUT' && record.type !== 'CHECK_OUT' && record.type !== 'TAN_CA') return false;
        if (attendanceStatusFilter === 'ON_TIME' && record.punctuality !== 'ON_TIME') return false;
        if (attendanceStatusFilter === 'LATE' && record.punctuality !== 'LATE') return false;
        if (attendanceStatusFilter === 'EARLY_LEAVE' && record.punctuality !== 'EARLY_LEAVE') return false;
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [attendance, currentEmp, startDate, endDate, attendanceTypeFilter, attendanceStatusFilter]);

  // 2. Attendance Statistics
  const attendanceStats = useMemo<AttendanceStats>(() => {
    if (!currentEmp) {
      return { totalLogs: 0, checkIns: 0, checkOuts: 0, workDays: 0, lateCount: 0, earlyLeaveCount: 0, avgConfidence: 0 };
    }
    const empLogs = attendance.filter((r) => {
      if (r.employee_id !== currentEmp.employee_id && r.employee_id !== currentEmp.id) return false;
      const rDate = formatVNDateISO(r.timestamp);
      if (startDate && rDate < startDate) return false;
      if (endDate && rDate > endDate) return false;
      return true;
    });

    const checkIns = empLogs.filter((r) => r.type === 'CHECK_IN').length;
    const checkOuts = empLogs.filter((r) => r.type === 'CHECK_OUT' || r.type === 'TAN_CA').length;
    const distinctDays = new Set(empLogs.map((r) => formatVNDateISO(r.timestamp))).size;
    const lateCount = empLogs.filter((r) => r.punctuality === 'LATE').length;
    const earlyLeaveCount = empLogs.filter((r) => r.punctuality === 'EARLY_LEAVE').length;

    const scores = empLogs
      .map((r) => r.verification_score)
      .filter((s): s is number => s !== null && s !== undefined && !isNaN(Number(s)) && Number(s) > 0)
      .map((s) => {
        const val = Number(s);
        return val <= 1 ? val * 100 : val;
      });
    const avgConfidence = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    return {
      totalLogs: empLogs.length,
      checkIns,
      checkOuts,
      workDays: distinctDays,
      lateCount,
      earlyLeaveCount,
      avgConfidence: Math.round(avgConfidence * 10) / 10,
    };
  }, [attendance, currentEmp, startDate, endDate]);

  return {
    employeeAttendanceLogs,
    attendanceStats,
  };
}
