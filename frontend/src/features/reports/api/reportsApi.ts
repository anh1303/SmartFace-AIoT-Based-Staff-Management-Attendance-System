import { apiFetch } from '../../../api/client';
import type { ReportsSummaryKpisData } from '../components/ReportsSummaryKpis';
import type {
  MethodConfidenceStats,
  DailyPunctualityPoint,
} from '../components/ReportsBiometricAndPunctualityCharts';
import type { DepartmentSummaryRow } from '../components/ReportsDepartmentTable';
import type { EmployeeLeaderboardItem } from '../components/ReportsEmployeeLeaderboard';

export interface MonthlyReportData {
  selectedPeriod: string;
  availablePeriods: string[];
  summary: ReportsSummaryKpisData;
  biometrics: {
    face: MethodConfidenceStats;
    fingerprint: MethodConfidenceStats;
  };
  dailyPunctuality: DailyPunctualityPoint[];
  departments: DepartmentSummaryRow[];
  leaderboard: EmployeeLeaderboardItem[];
}

export async function fetchMonthlyReportApi(period?: string): Promise<MonthlyReportData> {
  const query = period ? `?period=${encodeURIComponent(period)}` : '';
  const res = await apiFetch(`/api/reports/monthly${query}`);
  if (res.success && res.data) {
    return res.data;
  }
  throw new Error(res.message || 'Không thể tải dữ liệu báo cáo từ hệ thống');
}
