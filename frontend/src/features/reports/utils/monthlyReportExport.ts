import * as XLSX from 'xlsx';
import type { MonthlyReportData } from '../api/reportsApi';
import { calculateAutoFitWidths } from '@/utils/excelExport';
import { printHtml } from '@/utils/reportPrint';
import { saveWorkbook } from '@/utils/saveWorkbook';

type Cell = string | number | null;
type Sheet = { name: string; headers: string[]; rows: Cell[][] };

export function buildMonthlyReportSheets(data: MonthlyReportData, hideDepartments: boolean): Sheet[] {
  const s = data.summary;
  const summary: Cell[][] = [
    ...(!hideDepartments ? [['Phòng ban', s.departmentCount] as Cell[]] : []),
    ['Nhân viên', s.employeeCount], ['Tổng số ca', s.totalShiftsCount],
    ['Tăng ca (giờ)', s.totalOvertimeHours], ['Đi muộn / Về sớm (giờ)', s.totalLateEarlyHours],
    ['Nghỉ làm không lý do (ca)', s.unexcusedAbsenceCount], ['Tỉ lệ đúng giờ (%)', s.totalPunches ? s.onTimeRate : null],
    ['Tổng lương (VNĐ)', s.totalSalary],
  ];
  const method = (name: string, stats: MonthlyReportData['biometrics']['face']): Cell[] =>
    [name, stats.totalCount, stats.pctOfTotal, stats.tierGt95, stats.tierMid, stats.tierLt80];
  const sheets: Sheet[] = [
    { name: 'Tổng quan', headers: ['Chỉ số', 'Giá trị'], rows: summary },
    { name: 'Phương thức chấm công', headers: ['Phương thức', 'Số lượt', 'Tỉ lệ (%)', 'Độ tin cậy ≥95%', 'Độ tin cậy 80–<95%', 'Độ tin cậy <80%'], rows: [method('Khuôn mặt', data.biometrics.face), method('Vân tay', data.biometrics.fingerprint)] },
    { name: 'Đúng giờ theo ngày', headers: ['Ngày', 'Đúng giờ', 'Tổng số', 'Tỉ lệ đúng giờ (%)'], rows: data.dailyPunctuality.map(d => [d.day, d.onTime, d.total, d.rate ?? null]) },
  ];
  if (!hideDepartments) sheets.push({ name: 'Phòng ban', headers: ['Phòng ban', 'Nhân viên', 'Số lần chấm công', 'Tăng ca (giờ)', 'Đi muộn / Về sớm (giờ)', 'Nghỉ làm (ca)', 'Tỉ lệ đúng giờ (%)', 'Quỹ lương (VNĐ)'], rows: data.departments.map(d => [d.departmentName, d.employeeCount, d.totalPunches, d.totalOvertimeHours, d.totalLateEarlyHours, d.unexcusedAbsenceCount, d.totalPunches ? d.onTimeRate : null, d.totalSalary]) });
  sheets.push({ name: 'Chuyên cần', headers: ['Hạng', 'Mã NV', 'Họ và tên', 'Phòng ban', 'Số lần chấm công', 'Tăng ca (giờ)', 'Đi muộn / Về sớm (giờ)', 'Nghỉ làm (ca)', 'Tỉ lệ đúng giờ (%)', 'Quỹ lương (VNĐ)', 'Đánh giá'], rows: data.leaderboard.map(e => [e.rank, e.employeeId, e.fullName, e.department, e.punchCount, e.overtimeHours, e.lateEarlyHours, e.absenceCount, e.punchCount ? e.onTimeRate : null, e.salary, !e.punchCount ? 'Chưa có dữ liệu' : e.onTimeRate >= 95 ? 'Xuất sắc' : e.onTimeRate >= 80 ? 'Tốt' : 'Cần chú ý']) });
  return sheets;
}

export function exportMonthlyExcel(data: MonthlyReportData, hideDepartments: boolean): Promise<boolean> {
  const workbook = XLSX.utils.book_new();
  for (const sheet of buildMonthlyReportSheets(data, hideDepartments)) {
    const worksheet = XLSX.utils.aoa_to_sheet([sheet.headers, ...sheet.rows]);
    worksheet['!cols'] = calculateAutoFitWidths(sheet.headers, sheet.rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
  }
  return saveWorkbook(workbook, `Bao_cao_thong_ke_${data.selectedPeriod}.xlsx`);
}

const escape = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildMonthlyReportHtml(data: MonthlyReportData, hideDepartments: boolean, charts: string[] = []): string {
  const tables = buildMonthlyReportSheets(data, hideDepartments).map((sheet, index) => {
    const cells = (row: Cell[], tag: string) => row.map(value => `<${tag}>${escape(value)}</${tag}>`).join('');
    const chart = index === 2 ? (charts[2] || '') : '';
    const table = index === 2 ? '' : `<table><thead><tr>${cells(sheet.headers, 'th')}</tr></thead><tbody>${sheet.rows.map(row => `<tr>${cells(row, 'td')}</tr>`).join('')}</tbody></table>`;
    return `<section><h2>${index + 1}. ${escape(sheet.name)}</h2>${chart ? `<div class="charts">${chart}</div>` : ''}${table}</section>`;
  }).join('');
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Bao_cao_thong_ke_${escape(data.selectedPeriod)}</title><style>@page{size:A4 portrait;margin:0}body{margin:15mm;font-family:'Times New Roman',serif;color:#000}h1{text-align:center;font-size:18pt}h2{font-size:13pt;margin:18px 0 8px}p{text-align:center}table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8pt}th,td{border:1px solid #000;padding:4px;overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.charts{display:flex;justify-content:center;gap:15px;break-inside:avoid}.charts svg{max-width:100%;height:auto;max-height:160px}</style></head><body><h1>BÁO CÁO &amp; THỐNG KÊ</h1><p>Tháng báo cáo: ${escape(data.selectedPeriod)}</p>${tables}</body></html>`;
}

export function printMonthlyReport(data: MonthlyReportData, hideDepartments: boolean, chartContainer: HTMLElement | null): void {
  const charts = chartContainer ? Array.from(chartContainer.querySelectorAll('svg.recharts-surface')).map(svg => svg.outerHTML) : [];
  printHtml(buildMonthlyReportHtml(data, hideDepartments, charts));
}
