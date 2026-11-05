import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ReportsHeader,
  ReportsSummaryKpis,
  ReportsBiometricAndPunctualityCharts,
  ReportsDepartmentTable,
  ReportsEmployeeLeaderboard,
  ExportReportsModal,
  ExportReportType,
  useMonthlyReport,
} from '@/features/reports';
import { exportToExcel } from '@/utils/excelExport';

export const ManagerReports: React.FC = () => {
  const { employees, selectedPeriod, setSelectedPeriod, showToast } = useApp();

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportReportType>('attendance');

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

  // Excel (.xlsx) Export logic
  const handleExecuteExport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileName = '';
    let sheetName = 'Báo cáo';

    if (exportType === 'attendance') {
      sheetName = 'Chuyên cần nhân viên';
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Số Lần Chấm Công',
        'Giờ Tăng Ca (h)',
        'Đi Muộn / Về Sớm (h)',
        'Số Ca Nghỉ Làm',
        'Tỉ Lệ Đúng Giờ (%)',
        'Quỹ Lương (VNĐ)',
      ];

      rows = leaderboardData.map((item) => [
        item.employeeId,
        item.fullName,
        item.department,
        item.punchCount,
        Number(item.overtimeHours.toFixed(1)),
        Number(item.lateEarlyHours.toFixed(1)),
        item.absenceCount,
        item.punchCount > 0 ? `${item.onTimeRate}%` : '',
        item.salary ?? '',
      ]);

      fileName = `Bao_cao_chuyen_can_nhan_vien_${selectedPeriod}.xlsx`;
    } else if (exportType === 'payroll') {
      sheetName = 'Tổng hợp phòng ban';
      headers = [
        'Phòng Ban',
        'Số Nhân Viên',
        'Số Lần Chấm Công',
        'Giờ Tăng Ca (h)',
        'Đi Muộn / Về Sớm (h)',
        'Số Ca Nghỉ Làm',
        'Tỉ Lệ Đúng Giờ (%)',
        'Quỹ Lương (VNĐ)',
      ];

      rows = departmentsData.map((d) => [
        d.departmentName,
        d.employeeCount,
        d.totalPunches,
        Number(d.totalOvertimeHours.toFixed(1)),
        Number(d.totalLateEarlyHours.toFixed(1)),
        d.unexcusedAbsenceCount,
        d.totalPunches > 0 ? `${d.onTimeRate}%` : '',
        d.totalSalary,
      ]);

      fileName = `Bao_cao_tong_hop_phong_ban_${selectedPeriod}.xlsx`;
    } else {
      sheetName = 'Danh sách nhân sự';
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Chức Vụ',
        'Email',
        'Trạng Thái',
        'Lương Theo Giờ (VNĐ)',
      ];

      rows = employees.map((emp) => [
        emp.employee_id,
        emp.full_name,
        emp.department,
        emp.position,
        emp.email,
        emp.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm ngưng',
        emp.hourly_rate || 0,
      ]);

      fileName = `Danh_sach_nhan_su_${selectedPeriod}.xlsx`;
    }

    exportToExcel({
      sheetName,
      headers,
      rows,
      fileName,
    });

    setIsExportModalOpen(false);
    showToast(`Đã xuất báo cáo Excel: ${fileName}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Hàng 1: Header với icon, tiêu đề "Báo cáo & Thống kê", Tháng báo cáo, nút Xuất CSV */}
      <ReportsHeader
        selectedPeriod={selectedPeriod}
        onSelectPeriod={setSelectedPeriod}
        availablePeriods={availablePeriods}
        onOpenExportModal={() => setIsExportModalOpen(true)}
      />

      {/* Hàng 2: 8 Hộp Thống Kê KPI */}
      <ReportsSummaryKpis data={summaryKpisData} />

      {/* Hàng 3: Phương thức chấm công (2 Donut) + Biểu đồ tỷ lệ đúng giờ theo ngày */}
      <ReportsBiometricAndPunctualityCharts
        faceStats={faceStats}
        fpStats={fpStats}
        dailyPunctualityData={dailyPunctualityData}
        selectedPeriod={selectedPeriod}
      />

      {/* Hàng 4: Bảng Tổng hợp theo phòng ban */}
      <ReportsDepartmentTable
        departmentsData={departmentsData}
        selectedPeriod={selectedPeriod}
      />

      {/* Hàng 5: Bảng xếp hạng chuyên cần nhân viên */}
      <ReportsEmployeeLeaderboard
        leaderboardData={leaderboardData}
        selectedPeriod={selectedPeriod}
      />

      {/* CSV Export Option Modal */}
      <ExportReportsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        exportType={exportType}
        onSelectExportType={setExportType}
        onExecuteExport={handleExecuteExport}
      />
    </div>
  );
};

export default ManagerReports;
