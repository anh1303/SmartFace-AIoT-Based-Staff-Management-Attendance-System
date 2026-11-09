import { describe, expect, it } from 'vitest';
import { buildMonthlyReportHtml, buildMonthlyReportSheets } from '../monthlyReportExport';
import type { MonthlyReportData } from '../../api/reportsApi';

const report: MonthlyReportData = {
  selectedPeriod: '2026-11', availablePeriods: [],
  summary: { selectedPeriod: '2026-11', departmentCount: 1, employeeCount: 2, totalShiftsCount: 3, totalOvertimeHours: 4, totalLateEarlyHours: 5, unexcusedAbsenceCount: 6, onTimePunches: 7, totalPunches: 8, onTimeRate: 87.5, totalSalary: 900 },
  biometrics: { face: { totalCount: 2, pctOfTotal: 100, tierGt95: 1, tierMid: 1, tierLt80: 0 }, fingerprint: { totalCount: 0, pctOfTotal: 0, tierGt95: 0, tierMid: 0, tierLt80: 0 } },
  dailyPunctuality: [{ day: '01', rate: 50, total: 2, onTime: 1 }],
  departments: [{ departmentName: 'IT', employeeCount: 2, totalPunches: 2, totalOvertimeHours: 1, totalLateEarlyHours: 0, unexcusedAbsenceCount: 0, onTimeRate: 50, totalSalary: 900 }],
  leaderboard: [{ rank: 1, employeeId: 'NV01', fullName: 'Nguyễn An', department: 'IT', punchCount: 2, overtimeHours: 1, lateEarlyHours: 0, absenceCount: 0, onTimeRate: 50, salary: 900 }],
};

describe('xuất báo cáo tháng', () => {
  it('bao gồm dữ liệu các phần trên trang và giữ giá trị số', () => {
    const sheets = buildMonthlyReportSheets(report, false);
    expect(sheets.map(sheet => sheet.name)).toEqual(['Tổng quan', 'Phương thức chấm công', 'Đúng giờ theo ngày', 'Phòng ban', 'Chuyên cần']);
    expect(sheets[2].rows[0]).toEqual(['01', 1, 2, 50]);
    expect(sheets[4].rows[0]).toContain('Nguyễn An');
  });
  it('ẩn thông tin phòng ban tổng hợp với quản lý', () => {
    const sheets = buildMonthlyReportSheets(report, true);
    expect(sheets.some(sheet => sheet.name === 'Phòng ban')).toBe(false);
    expect(sheets[0].rows.some(row => row[0] === 'Phòng ban')).toBe(false);
  });
  it('tạo bản in có tháng, biểu đồ và các bảng theo quyền', () => {
    const html = buildMonthlyReportHtml(report, true, ['<svg id="face"></svg>', '<svg id="fingerprint"></svg>', '<svg id="daily"></svg>']);
    expect(html).toContain('2026-11');
    expect(html).toContain('<svg id="daily"></svg>');
    expect(html).toContain('1. Tổng quan');
    expect(html).toContain('2. Phương thức chấm công');
    expect(html).not.toContain('<svg id="face"></svg>');
    expect(html).not.toContain('<svg id="fingerprint"></svg>');
    expect(html).not.toContain('<th>Ngày</th>');
    expect(html).toContain('Nguyễn An');
    expect(html).not.toContain('. Phòng ban</h2>');
  });
});
