export interface DashboardKpisDto {
  workingEmployeesCount: number;
  totalEmployees: number;
  checkInCount: number;
  currentlyWorkingCount: number;
  checkOutCount: number;
}

export interface DashboardPunctualityDto {
  onTimeCount: number;
  lateCount: number;
  notCheckedInCount: number;
  onTimePct: number;
  latePct: number;
  notCheckedInPct: number;
  donutData: Array<{ name: string; value: number; color: string }>;
}

export type ShiftLiveStatusCode = 'UPCOMING' | 'ONGOING' | 'ENDED';

export interface DashboardShiftGroupDto {
  id: string;
  name: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  count: number;
  type: string;
  liveStatus: {
    code: ShiftLiveStatusCode;
    label: string;
    style: string;
  };
}

export interface DashboardDepartmentProgressDto {
  name: string;
  scheduled: number;
  total: number;
  pct: number;
  color: string;
}

export interface DashboardEmployeeShiftItemDto {
  employeeId: string;
  fullName: string;
  avatar: string | null;
  department: string;
  hasShift: boolean;
  shiftName: string;
}

export interface DashboardRecentLogDto {
  attendance_id: string;
  employee_id: string;
  employee_name: string;
  avatar?: string | null;
  type: string;
  timestamp: string;
  device_id: string | null;
  verification_score?: number | null;
  status: string;
  statusInfo: {
    label: string;
    style: string;
  };
}

export interface DashboardAlertsDto {
  overdueEmployees: string[];
  upcomingShiftNotice: {
    name: string;
    time: string;
    minutesLeft: number;
  } | null;
}

export interface TodayDashboardResponseDto {
  dateStr: string;
  dateFormatted: string;
  kpis: DashboardKpisDto;
  punctuality: DashboardPunctualityDto;
  shifts: DashboardShiftGroupDto[];
  departmentProgress: DashboardDepartmentProgressDto[];
  employeeList: DashboardEmployeeShiftItemDto[];
  recentLogs: DashboardRecentLogDto[];
  alerts: DashboardAlertsDto;
}
