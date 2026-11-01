import { z } from 'zod';

export const monthlyReportQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Định dạng tháng phải là YYYY-MM').optional(),
  department_id: z.string().optional(),
});

export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;

export interface SummaryKpisDto {
  departmentCount: number;
  employeeCount: number;
  totalShiftsCount: number;
  totalOvertimeHours: number;
  totalLateEarlyHours: number;
  unexcusedAbsenceCount: number;
  onTimePunches: number;
  totalPunches: number;
  onTimeRate: number;
  totalSalary: number;
  selectedPeriod: string;
}

export interface BiometricMethodStatsDto {
  totalCount: number;
  pctOfTotal: number;
  tierGt95: number;
  tierMid: number;
  tierLt80: number;
}

export interface DailyPunctualityPointDto {
  day: string;
  rate?: number;
  total: number;
  onTime: number;
}

export interface DepartmentSummaryDto {
  departmentName: string;
  color: string;
  employeeCount: number;
  totalPunches: number;
  totalOvertimeHours: number;
  totalLateEarlyHours: number;
  unexcusedAbsenceCount: number;
  onTimeRate: number;
  totalSalary: number;
}

export interface EmployeeLeaderboardDto {
  rank: number;
  employeeId: string;
  fullName: string;
  avatar: string | null;
  department: string;
  punchCount: number;
  overtimeHours: number;
  lateEarlyHours: number;
  absenceCount: number;
  onTimeRate: number;
  salary: number;
}

export interface MonthlyReportResponseDto {
  selectedPeriod: string;
  availablePeriods: string[];
  summary: SummaryKpisDto;
  biometrics: {
    face: BiometricMethodStatsDto;
    fingerprint: BiometricMethodStatsDto;
  };
  dailyPunctuality: DailyPunctualityPointDto[];
  departments: DepartmentSummaryDto[];
  leaderboard: EmployeeLeaderboardDto[];
}
