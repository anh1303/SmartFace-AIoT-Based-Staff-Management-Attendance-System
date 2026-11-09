import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { PageHeaderBanner } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import {
  useDashboardToday,
  DashboardSummaryKpis,
  DashboardTodayShifts,
  DashboardPunctualityDonut,
  DashboardDepartmentProgress,
  DashboardRecentLogsTable,
  DashboardAlertsCard,
} from '@/features/dashboard';

export const ManagerDashboard: React.FC = () => {
  const { role, currentUser } = useAuth();
  const isAdmin =
    role === 'admin' ||
    currentUser?.role === 'admin' ||
    currentUser?.role_name?.toUpperCase() === 'ADMIN';

  // Backend Dashboard Real-time Query Hook
  const { dashboardData, isLoading, isError, error, refetch } = useDashboardToday();

  if (!dashboardData && isLoading) return <p role="status">Đang tải dữ liệu tổng quan…</p>;
  if (!dashboardData && isError) return <div className="sf-feedback error" role="alert">{error?.message || 'Không thể tải dữ liệu tổng quan.'} <button className="underline" onClick={() => refetch()}>Thử lại</button></div>;
  if (!dashboardData) return <p role="status">Chưa có dữ liệu tổng quan.</p>;

  // Fallback defaults to prevent layout shift during initial load
  const kpis = dashboardData?.kpis || {
    workingEmployeesCount: 0,
    totalEmployees: 0,
    checkInCount: 0,
    currentlyWorkingCount: 0,
    checkOutCount: 0,
  };

  const punctuality = dashboardData?.punctuality || {
    onTimeCount: 0,
    lateCount: 0,
    notCheckedInCount: 0,
    onTimePct: 0,
    latePct: 0,
    notCheckedInPct: 0,
    donutData: [{ name: 'Chưa có dữ liệu', value: 1, color: '#334155' }],
  };

  const shifts = dashboardData?.shifts || [];
  const departmentProgress = dashboardData?.departmentProgress || [];
  const employeeList = dashboardData?.employeeList || [];
  const recentLogs = dashboardData?.recentLogs || [];
  const alerts = dashboardData?.alerts || {
    overdueEmployees: [],
    upcomingShiftNotice: null,
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Tiêu đề Trang */}
      <PageHeaderBanner title="Tổng quan hệ thống" icon={<div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner"><LayoutDashboard className="w-5 h-5" /></div>} />

      {/* Hàng 1: 4 Thẻ KPI Tổng quan */}
      <DashboardSummaryKpis kpis={kpis} />

      {/* Hàng 2: Ca làm việc hôm nay + Tình hình chấm công hôm nay (Donut) + Tiến độ nhân viên */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <DashboardTodayShifts shifts={shifts} />
        </div>
        <div className="lg:col-span-4">
          <DashboardPunctualityDonut
            punctuality={punctuality}
            workingEmployeesCount={kpis.workingEmployeesCount}
          />
        </div>
        <div className="lg:col-span-4">
          <DashboardDepartmentProgress
            isAdmin={isAdmin}
            departmentProgress={departmentProgress}
            employeeList={employeeList}
          />
        </div>
      </div>

      {/* Hàng 3: Nhật ký chấm công hôm nay (8 cột) + Thẻ Chú ý cảnh báo (4 cột) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <DashboardRecentLogsTable logs={recentLogs} />
        </div>
        <div className="lg:col-span-4">
          <DashboardAlertsCard alerts={alerts} />
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
