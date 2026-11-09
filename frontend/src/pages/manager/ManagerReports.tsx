import React, { useRef } from 'react';
import { usePayrollContext } from '../../context/PayrollContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  ReportsHeader,
  ReportsSummaryKpis,
  ReportsBiometricAndPunctualityCharts,
  ReportsDepartmentTable,
  ReportsEmployeeLeaderboard,
  useMonthlyReport,
} from '@/features/reports';
import { exportMonthlyExcel, printMonthlyReport } from '@/features/reports';

export const ManagerReports: React.FC = () => {
  const { selectedPeriod, setSelectedPeriod } = usePayrollContext();
  const { showToast } = useToast();
  const { role } = useAuth();
  const isManager = role === 'manager';

  const chartRef = useRef<HTMLDivElement>(null);

  // Backend Reports Query Hook - Single Source of Truth
  const { reportData, isLoading, isError, error, refetch } = useMonthlyReport(selectedPeriod);

  if (!reportData && isLoading) return <p role="status">Đang tải báo cáo…</p>;
  if (!reportData && isError) return <div className="sf-feedback error" role="alert">{error?.message || 'Không thể tải báo cáo.'} <button className="underline" onClick={() => refetch()}>Thử lại</button></div>;
  if (!reportData) return <p role="status">Chưa có dữ liệu báo cáo.</p>;

  // Available Periods for Month Dropdown
  const availablePeriods = Array.from(new Set([selectedPeriod, ...reportData.availablePeriods]));

  // Data structures for presentation components
  const summaryKpisData = reportData?.summary || {
    departmentCount: 0,
    employeeCount: 0,
    totalShiftsCount: 0,
    totalOvertimeHours: 0,
    totalLateEarlyHours: 0,
    unexcusedAbsenceCount: 0,
    onTimePunches: 0,
    totalPunches: 0,
    onTimeRate: 0,
    totalSalary: 0,
    selectedPeriod,
  };

  const faceStats = reportData?.biometrics?.face || {
    totalCount: 0,
    pctOfTotal: 0,
    tierGt95: 0,
    tierMid: 0,
    tierLt80: 0,
  };

  const fpStats = reportData?.biometrics?.fingerprint || {
    totalCount: 0,
    pctOfTotal: 0,
    tierGt95: 0,
    tierMid: 0,
    tierLt80: 0,
  };

  const dailyPunctualityData = reportData?.dailyPunctuality || [];
  const departmentsData = reportData?.departments || [];
  const leaderboardData = reportData?.leaderboard || [];

  const handleExport = (format: 'excel' | 'pdf') => {
    if (format === 'excel') {
      return exportMonthlyExcel(reportData, isManager)
        .then(saved => { if (saved) showToast('Đã lưu báo cáo Excel.', 'success', "Xuất báo cáo thành công"); })
        .catch(() => showToast('Không thể lưu báo cáo.', 'error', "Không thể xuất báo cáo"));
    } else {
      printMonthlyReport(reportData, isManager, chartRef.current);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hàng 1: Header với icon, tiêu đề "Báo cáo & Thống kê", Tháng báo cáo, nút Xuất CSV */}
      <ReportsHeader
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        availablePeriods={availablePeriods}
        onOpenExportModal={handleExport}
      />

      {/* Hàng 2: 8 Hộp Thống Kê KPI */}
      <ReportsSummaryKpis data={summaryKpisData} hideDepartments={isManager} />

      {/* Hàng 3: Phương thức chấm công (2 Donut) + Biểu đồ tỷ lệ đúng giờ theo ngày */}
      <div ref={chartRef}><ReportsBiometricAndPunctualityCharts
        faceStats={faceStats}
        fpStats={fpStats}
        dailyPunctualityData={dailyPunctualityData}
        selectedPeriod={selectedPeriod}
      /></div>

      {/* Hàng 4: Bảng Tổng hợp theo phòng ban */}
      {!isManager && <ReportsDepartmentTable
        departmentsData={departmentsData}
        selectedPeriod={selectedPeriod}
      />}

      {/* Hàng 5: Bảng xếp hạng chuyên cần nhân viên */}
      <ReportsEmployeeLeaderboard
        leaderboardData={leaderboardData}
        selectedPeriod={selectedPeriod}
      />

    </div>
  );
};

export default ManagerReports;
