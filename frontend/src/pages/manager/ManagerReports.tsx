import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getTodayVNString, formatVNDateISO, getMonday, getISOWeekNumber } from '@/utils/dateUtils';
import {
  ReportsHeader,
  ReportsDateToolbar,
  ReportsChartsSection,
  ReportsBreakdownAndLeaderboard,
  ExportReportsModal,
  ExportReportType,
  EmployeeAttendanceStat,
} from '@/features/reports';

export const ManagerReports: React.FC = () => {
  const { employees, attendance, payroll, selectedPeriod, showToast } = useApp();

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<ExportReportType>('attendance');

  // Date Range State
  const [startDate, setStartDate] = useState<string>(() => getTodayVNString());
  const [endDate, setEndDate] = useState<string>(() => getTodayVNString());

  const handleStartDateChange = (newStart: string) => {
    if (!newStart) return;
    setStartDate(newStart);
    if (endDate && newStart > endDate) {
      setEndDate(newStart);
    }
  };

  const handleEndDateChange = (newEnd: string) => {
    if (!newEnd) return;
    setEndDate(newEnd);
    if (startDate && newEnd < startDate) {
      setStartDate(newEnd);
    }
  };

  const handleSelectToday = () => {
    const today = getTodayVNString();
    setStartDate(today);
    setEndDate(today);
  };

  const isTodaySelected = startDate === getTodayVNString() && endDate === getTodayVNString();
  const isSameDay = startDate === endDate;

  // Filter attendance logs by date range [startDate 00:00:00 -> endDate 23:59:59]
  const filteredAttendance = attendance.filter((a) => {
    const logDate = formatVNDateISO(a.timestamp);
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });

  // Dynamic Payroll Trend Data by Period
  const periodsMap: Record<string, number> = {};
  payroll.forEach((p) => {
    const period = p.period || p.payroll_period || '2026-09';
    const amount = Number(p.net_salary || 0);
    periodsMap[period] = (periodsMap[period] || 0) + amount;
  });

  const sortedPeriods = Object.keys(periodsMap).sort();
  const payrollTrendData = sortedPeriods.map((period) => ({
    period: `T${period.slice(5)}/${period.slice(2, 4)}`,
    cost: Number((periodsMap[period] / 1000000).toFixed(1)),
  }));

  // Dynamic Method Breakdown from Attendance Logs
  const totalLogs = filteredAttendance.length;
  const faceLogs = filteredAttendance.filter((a) => a.method === 'FACE').length;
  const fpLogs = filteredAttendance.filter((a) => a.method === 'FINGERPRINT').length;
  const manualLogs = filteredAttendance.filter((a) => a.method === 'MANUAL').length;

  const methodBreakdown = [
    {
      name: 'Khuôn mặt (Face ID 512D)',
      value: totalLogs > 0 ? Math.round((faceLogs / totalLogs) * 100) : 0,
      count: faceLogs,
      color: '#8b5cf6',
    },
    {
      name: 'Vân tay (Fingerprint)',
      value: totalLogs > 0 ? Math.round((fpLogs / totalLogs) * 100) : 0,
      count: fpLogs,
      color: '#10b981',
    },
    {
      name: 'Thủ công (Manual Kiosk)',
      value: totalLogs > 0 ? Math.round((manualLogs / totalLogs) * 100) : 0,
      count: manualLogs,
      color: '#f59e0b',
    },
  ];

  // Dynamic 4-Week Punctuality Trend
  const currentMonday = getMonday(new Date());
  currentMonday.setHours(0, 0, 0, 0);

  const punctualityData = [3, 2, 1, 0].map((weeksAgo) => {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - weeksAgo * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekNum = getISOWeekNumber(weekStart);
    const weekAttendance = attendance.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return t >= weekStart.getTime() && t <= weekEnd.getTime();
    });

    const total = weekAttendance.length;
    const onTime = weekAttendance.filter(
      (a) => (a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status)) === 'ON_TIME'
    ).length;
    const rate = total > 0 ? Number(((onTime / total) * 100).toFixed(1)) : 0;

    return {
      week: `Tuần ${weekNum}`,
      rate,
      count: total,
      onTimeCount: onTime,
    };
  });

  const hasPunctualityData = attendance.length > 0 && punctualityData.some((p) => p.count > 0);

  // Dynamic Leaderboard from attendance logs
  const empStats: EmployeeAttendanceStat[] = employees
    .map((emp) => {
      const empAtt = filteredAttendance.filter((a) => a.employee_id === emp.employee_id);
      const totalPunches = empAtt.length;
      const onTimePunches = empAtt.filter(
        (a) => (a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status)) === 'ON_TIME'
      ).length;
      const latePunches = totalPunches - onTimePunches;
      const rateNum = totalPunches > 0 ? (onTimePunches / totalPunches) * 100 : 0;

      let badge = 'XUẤT SẮC';
      if (totalPunches === 0) badge = 'CHƯA CÓ LƯỢT';
      else if (rateNum < 90) badge = 'CẦN LƯU Ý';
      else if (rateNum < 98) badge = 'TỐT';

      return {
        id: emp.employee_id,
        name: emp.full_name,
        dept: emp.department || 'Chung',
        position: emp.position || 'Nhân viên',
        totalPunches,
        onTimePunches,
        latePunches,
        rate: totalPunches > 0 ? `${rateNum.toFixed(1)}%` : '--',
        rateNum,
        onTime: `${onTimePunches}/${totalPunches} lượt`,
        badge,
      };
    })
    .sort((a, b) => b.rateNum - a.rateNum);

  const handleExecuteExport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileName = '';

    if (exportType === 'attendance') {
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Chức Vụ',
        'Tổng Số Lượt Điểm Danh',
        'Số Lượt Đúng Giờ',
        'Số Lượt Đi Muộn / Về Sớm',
        'Tỷ Lệ Đúng Giờ (%)',
        'Xếp Loại Chuyên Cần',
      ];

      rows = empStats.map((stat) => [
        stat.id,
        `"${stat.name}"`,
        `"${stat.dept}"`,
        `"${stat.position}"`,
        stat.totalPunches,
        stat.onTimePunches,
        stat.latePunches,
        stat.totalPunches > 0 ? `${stat.rateNum.toFixed(1)}%` : '0%',
        `"${stat.badge}"`,
      ]);

      fileName = isSameDay
        ? `Bao_cao_tong_hop_chuyen_can_${startDate}.csv`
        : `Bao_cao_tong_hop_chuyen_can_${startDate}_den_${endDate}.csv`;
    } else if (exportType === 'payroll') {
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Kỳ Lương',
        'Lương Theo Giờ (VNĐ)',
        'Tổng Giờ Làm (h)',
        'Số Giờ Tăng Ca (h)',
        'Số Giờ Đi Trễ / Về Sớm (h)',
        'Phụ Cấp (VNĐ)',
        'Thực Lĩnh Net (VNĐ)',
        'Trạng Thái',
      ];

      const activeRecords = payroll.length > 0 ? payroll : [];
      rows = activeRecords.map((r) => {
        const emp = employees.find((e) => e.employee_id === r.employee_id);
        const name = emp?.full_name || r.employee_name || r.employee_id;
        const statusStr = r.status === 'PAID'
          ? 'Đã Thanh Toán'
          : r.status === 'FINALIZED'
          ? 'Đã Chốt'
          : r.status === 'CONFIRMED'
          ? 'Đã Xác Nhận'
          : 'Đang Soạn Thảo';
        return [
          r.employee_id,
          `"${name}"`,
          r.period || r.payroll_period || selectedPeriod,
          r.hourly_rate || 0,
          r.total_working_hours || 0,
          r.total_overtime ?? 0,
          r.total_late_early ?? 0,
          r.allowance || 0,
          r.net_salary || 0,
          `"${statusStr}"`,
        ];
      });

      fileName = `Bao_cao_chi_phi_luong_${selectedPeriod || getTodayVNString()}.csv`;
    } else {
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Chức Vụ',
        'Email',
        'Trạng Thái',
        'Lương Theo Giờ (VNĐ)',
        'Face ID 512D',
        'Vân Tay',
      ];

      rows = employees.map((emp) => [
        emp.employee_id,
        `"${emp.full_name}"`,
        `"${emp.department}"`,
        `"${emp.position}"`,
        emp.email,
        emp.status === 'ACTIVE' ? 'Đang Làm Việc' : 'Tạm Dừng',
        emp.hourly_rate || 0,
        emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ',
        emp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ',
      ]);

      fileName = `Danh_sach_nhan_su_va_sinh_trac_${getTodayVNString()}.csv`;
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
    showToast(`Đã xuất báo cáo CSV: ${fileName}`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Bento Header */}
      <ReportsHeader onOpenExportModal={() => setIsExportModalOpen(true)} />

      {/* Date Range Toolbar */}
      <ReportsDateToolbar
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onSelectToday={handleSelectToday}
        isTodaySelected={isTodaySelected}
        isSameDay={isSameDay}
        totalAttendanceCount={filteredAttendance.length}
      />

      {/* Bento Charts Grid: Payroll & Weekly Punctuality */}
      <ReportsChartsSection
        payrollTrendData={payrollTrendData}
        punctualityData={punctualityData}
        hasPunctualityData={hasPunctualityData}
      />

      {/* Bento Method Breakdown & Attendance Leaderboard */}
      <ReportsBreakdownAndLeaderboard
        methodBreakdown={methodBreakdown}
        totalLogs={totalLogs}
        empStats={empStats}
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