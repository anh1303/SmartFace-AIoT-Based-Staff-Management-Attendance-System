import { apiFetch } from '../../../api/client';

export interface DashboardKpis {
  workingEmployeesCount: number;
  totalEmployees: number;
  checkInCount: number;
  currentlyWorkingCount: number;
  checkOutCount: number;
}

export interface DashboardPunctuality {
  onTimeCount: number;
  lateCount: number;
  notCheckedInCount: number;
  onTimePct: number;
  latePct: number;
  notCheckedInPct: number;
  donutData: Array<{ name: string; value: number; color: string }>;
}

export type ShiftLiveStatusCode = 'UPCOMING' | 'ONGOING' | 'ENDED';

export interface DashboardShiftGroup {
  id: string;
  name: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  count: number;
  type: string;
  liveStatus: {
    code?: ShiftLiveStatusCode;
    label: string;
    style?: string;
  };
}

export interface DashboardDepartmentProgressItem {
  name: string;
  scheduled: number;
  total: number;
  pct: number;
  color: string;
}

export interface DashboardEmployeeShiftItem {
  employeeId: string;
  fullName: string;
  avatar: string | null;
  department: string;
  hasShift: boolean;
  shiftName: string;
}

export interface DashboardRecentLog {
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

export interface DashboardAlerts {
  overdueEmployees: string[];
  upcomingShiftNotice: {
    name: string;
    time: string;
    minutesLeft: number;
  } | null;
}

export interface TodayDashboardData {
  dateStr: string;
  dateFormatted: string;
  kpis: DashboardKpis;
  punctuality: DashboardPunctuality;
  shifts: DashboardShiftGroup[];
  departmentProgress: DashboardDepartmentProgressItem[];
  employeeList: DashboardEmployeeShiftItem[];
  recentLogs: DashboardRecentLog[];
  alerts: DashboardAlerts;
}

export async function fetchTodayDashboardApi(): Promise<TodayDashboardData> {
  const res = await apiFetch('/api/dashboard/today');
  if (res.success && res.data) {
    return res.data;
  }
  throw new Error(res.message || 'Không thể tải dữ liệu tổng quan hôm nay');
}
