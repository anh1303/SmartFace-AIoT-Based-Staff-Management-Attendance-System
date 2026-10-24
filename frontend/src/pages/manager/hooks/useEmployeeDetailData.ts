import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Employee } from '@/types';
import { useEmployeeAttendanceDetail, type AttendanceStats } from '@/features/attendances';
import { useEmployeePayrollDetail } from '@/features/payrolls';

export type { AttendanceStats };

export interface UseEmployeeDetailDataOptions {
  currentEmp: Employee | null;
  startDate?: string;
  endDate?: string;
  attendanceTypeFilter?: string;
  attendanceStatusFilter?: string;
}

/**
 * Page Composition Hook: Phối hợp dữ liệu đa phân hệ cho trang ManagerEmployeeDetail.
 * Orchestrates:
 * - useEmployeeAttendanceDetail (@/features/attendances)
 * - useEmployeePayrollDetail (@/features/payrolls)
 * - workShifts (AppContext)
 */
export function useEmployeeDetailData(options: UseEmployeeDetailDataOptions) {
  const { currentEmp, startDate, endDate, attendanceTypeFilter, attendanceStatusFilter } = options;
  const { workShifts } = useApp();

  // 1. Phân hệ Chấm công chuyên biệt
  const { employeeAttendanceLogs, attendanceStats } = useEmployeeAttendanceDetail({
    currentEmp,
    startDate,
    endDate,
    attendanceTypeFilter,
    attendanceStatusFilter,
  });

  // 2. Phân hệ Bảng lương chuyên biệt
  const payrollDetails = useEmployeePayrollDetail({
    currentEmp,
    workDays: attendanceStats.workDays,
    lateCount: attendanceStats.lateCount,
  });

  // 3. Phân hệ Lịch ca làm việc
  const employeeShifts = useMemo(() => {
    if (!currentEmp) return [];
    return workShifts
      .filter((s) => s.employee_id === currentEmp.employee_id || s.employee_id === currentEmp.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [workShifts, currentEmp]);

  return {
    employeeAttendanceLogs,
    attendanceStats,
    ...payrollDetails,
    employeeShifts,
  };
}
