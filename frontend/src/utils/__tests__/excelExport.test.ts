import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { calculateAutoFitWidths, exportToExcel } from '../excelExport';

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

describe('excelExport utility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateAutoFitWidths computes max text length with padding', () => {
    const headers = ['Mã NV', 'Họ và Tên'];
    const rows = [
      ['NV001', 'Nguyễn Văn A'],
      ['NV002', 'Trần Thị Rất Dài Cần Giãn Rộng'],
    ];

    const widths = calculateAutoFitWidths(headers, rows);
    expect(widths).toHaveLength(2);
    expect(widths[0].wch).toBeGreaterThanOrEqual(12);
    // 'Trần Thị Rất Dài Cần Giãn Rộng' has 30 chars => 30 + 3 = 33
    expect(widths[1].wch).toBeGreaterThanOrEqual(33);
  });

  it('calculateAutoFitWidths respects custom measureText function', () => {
    const headers = ['Ca làm việc'];
    const rows = [['Hành chính (08:00 - 17:00) [Ghi chú siêu dài cần bỏ qua]']];

    // Strip out [...] using measureText
    const measureText = (_colIdx: number, val: any) => {
      const s = String(val);
      return s.includes(' [') ? s.split(' [')[0] : s;
    };

    const widths = calculateAutoFitWidths(headers, rows, measureText);
    expect(widths[0].wch).toBe(26 + 3); // 'Hành chính (08:00 - 17:00)' length is 26
  });

  it('exportToExcel creates workbook and calls writeFile with clean .xlsx extension', () => {
    exportToExcel({
      sheetName: 'Bảng lương kỳ 2026-11',
      headers: ['Mã NV', 'Thực Lĩnh'],
      rows: [['NV001', 15000000]],
      fileName: 'Bang_luong_2026-11',
    });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [wb, fileName] = (XLSX.writeFile as any).mock.calls[0];
    expect(fileName).toBe('Bang_luong_2026-11.xlsx');
    expect(wb.SheetNames[0]).toBe('Bảng lương kỳ 2026-11');
  });
});
