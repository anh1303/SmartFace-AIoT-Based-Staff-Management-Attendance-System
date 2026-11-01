import React from 'react';
import { useApp } from '../../context/AppContext';
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
  const { role, currentUser } = useApp();
  const isAdmin =
    role === 'admin' ||
    currentUser?.role === 'admin' ||
    currentUser?.role_name?.toUpperCase() === 'ADMIN';

  // Backend Dashboard Real-time Query Hook
  const { dashboardData } = useDashboardToday();

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
      <div className="pb-2 border-b border-slate-200/80 dark:border-[#1d2243]">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Tổng quan hôm nay
        </h1>
      </div>

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
