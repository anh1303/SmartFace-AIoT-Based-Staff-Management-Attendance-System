import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildScheduleMatrixData,
  calculateAutoFitColumnWidths,
  exportScheduleToExcel,
} from '../scheduleExport';
import { Employee, WorkShift } from '@/types';
import { DayOfWeekItem } from '../../components/ScheduleMatrixTable';

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

describe('scheduleExport utility', () => {
  const mockDaysOfWeek: DayOfWeekItem[] = [
    { name: 'Thứ 2', date: '2026-11-02', label: '02/11', offset: 0 },
    { name: 'Thứ 3', date: '2026-11-03', label: '03/11', offset: 1 },
    { name: 'Thứ 4', date: '2026-11-04', label: '04/11', offset: 2 },
    { name: 'Thứ 5', date: '2026-11-05', label: '05/11', offset: 3 },
    { name: 'Thứ 6', date: '2026-11-06', label: '06/11', offset: 4 },
    { name: 'Thứ 7', date: '2026-11-07', label: '07/11', offset: 5 },
    { name: 'Chủ Nhật', date: '2026-11-08', label: '08/11', offset: 6 },
  ];

  const mockEmployees: Employee[] = [
    {
      employee_id: 'NV001',
      full_name: 'Nguyễn Văn A',
      department: 'Kỹ Thuật',
      position: 'Lập trình viên',
      status: 'ACTIVE',
      email: 'a@example.com',
      phone: '0123456789',
      role: 'employee',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      face_enrolled: false,
      fingerprint_enrolled: false,
    },
    {
      employee_id: 'NV002',
      full_name: 'Trần Thị B',
      department: 'Kế Toán',
      position: 'Kế toán viên',
      status: 'ACTIVE',
      email: 'b@example.com',
      phone: '0987654321',
      role: 'employee',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      face_enrolled: false,
      fingerprint_enrolled: false,
    },
  ];

  const mockWorkShifts: WorkShift[] = [
    {
      shift_id: 's1',
      employee_id: 'NV001',
      date: '2026-11-02',
      start_time: '08:00',
      end_time: '17:00',
      shift_type: 'OFFICE_HOURS',
      department: 'Kỹ Thuật',
      note: 'Trực ca sáng',
    },
    {
      shift_id: 's2',
      employee_id: 'NV001',
      date: '2026-11-03',
      start_time: '06:00',
      end_time: '14:00',
      shift_type: 'MORNING',
      department: 'Kỹ Thuật',
    },
    {
      shift_id: 's3',
      employee_id: 'NV001',
      date: '2026-11-04',
      start_time: '00:00',
      end_time: '00:00',
      shift_type: 'OFF',
      department: 'Kỹ Thuật',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildScheduleMatrixData generates correct headers and matrix row data', () => {
    const { headers, rows } = buildScheduleMatrixData(
      mockEmployees,
      mockDaysOfWeek,
      mockWorkShifts
    );

    expect(headers).toEqual([
      'Mã NV',
      'Họ và Tên',
      'Phòng ban',
      'Chức vụ',
      'Thứ 2 (02/11)',
      'Thứ 3 (03/11)',
      'Thứ 4 (04/11)',
      'Thứ 5 (05/11)',
      'Thứ 6 (06/11)',
      'Thứ 7 (07/11)',
      'Chủ Nhật (08/11)',
      'Tổng Ca Làm',
      'Tổng Giờ Dự Kiến (giờ)',
    ]);

    expect(rows).toHaveLength(2);

    const rowEmp1 = rows[0];
    expect(rowEmp1[0]).toBe('NV001');
    expect(rowEmp1[1]).toBe('Nguyễn Văn A');
    expect(rowEmp1[2]).toBe('Kỹ Thuật');
    expect(rowEmp1[3]).toBe('Lập trình viên');
    // Monday: OFFICE_HOURS (08:00 - 17:00) with note
    expect(rowEmp1[4]).toBe('Hành chính (08:00 - 17:00) [Trực ca sáng]');
    // Tuesday: MORNING (06:00 - 14:00) without note
    expect(rowEmp1[5]).toBe('Ca Sáng (06:00 - 14:00)');
    // Wednesday: OFF
    expect(rowEmp1[6]).toBe('Nghỉ ca');
    // Thursday: No shift assigned
    expect(rowEmp1[7]).toBe('Nghỉ ca');
    // Total shifts: 2 active shifts (s1 and s2, s3 is OFF)
    expect(rowEmp1[11]).toBe(2);
    // Total hours: 9h (08:00-17:00) + 8h (06:00-14:00) = 17h
    expect(rowEmp1[12]).toBe(17);

    const rowEmp2 = rows[1];
    expect(rowEmp2[0]).toBe('NV002');
    expect(rowEmp2[11]).toBe(0);
    expect(rowEmp2[12]).toBe(0);
  });

  it('calculateAutoFitColumnWidths properly calculates max string length with padding', () => {
    const headers = ['Mã NV', 'Họ và Tên'];
    const rows = [
      ['NV001', 'Nguyễn Văn Rất Dài Cần Giãn Rộng Cột'],
      ['NV002', 'Trần B'],
    ];

    const widths = calculateAutoFitColumnWidths(headers, rows);
    expect(widths).toHaveLength(2);
    // Col 0: 'NV001' is 5 chars, min width is 12
    expect(widths[0].wch).toBeGreaterThanOrEqual(12);
    // Col 1: 'Nguyễn Văn Rất Dài Cần Giãn Rộng Cột' is 36 chars => width >= 36 + 3 = 39
    expect(widths[1].wch).toBeGreaterThanOrEqual(39);
  });

  it('calculateAutoFitColumnWidths ignores notes in day columns so table does not stretch excessively', () => {
    const headers = ['Mã NV', 'Họ và Tên', 'Phòng ban', 'Chức vụ', 'Thứ 2 (02/11)'];
    // Very long note of 80 characters in column index 4 (Thứ 2)
    const longNoteShift = 'Hành chính (08:00 - 17:00) [Ghi chú rất dài chuẩn bị sự kiện hội thảo cho 200 nhân viên]';
    const rows = [
      ['NV001', 'Nguyễn Văn A', 'Kỹ Thuật', 'Nhân viên', longNoteShift],
    ];

    // Day column starts at index 4, count 1
    const widths = calculateAutoFitColumnWidths(headers, rows, 4, 1);
    expect(widths).toHaveLength(5);
    // Base shift is 'Hành chính (08:00 - 17:00)' with length 26.
    // 26 + 3 = 29. It should NOT be 88 + 3 = 91!
    expect(widths[4].wch).toBeLessThan(35);
    expect(widths[4].wch).toBe(29);
  });

  it('exportScheduleToExcel warns if filteredEmployees is empty', () => {
    const showToast = vi.fn();
    exportScheduleToExcel({
      filteredEmployees: [],
      daysOfWeek: mockDaysOfWeek,
      workShifts: mockWorkShifts,
      weekNumber: 45,
      startLabel: '02/11',
      endLabel: '08/11',
      showToast,
    });

    expect(showToast).toHaveBeenCalledWith(
      'Không có dữ liệu nhân viên để xuất Excel!',
      'warning'
    );
    expect(XLSX.writeFile).not.toHaveBeenCalled();
  });

  it('exportScheduleToExcel creates XLSX file and calls showToast with success', () => {
    const showToast = vi.fn();
    exportScheduleToExcel({
      filteredEmployees: mockEmployees,
      daysOfWeek: mockDaysOfWeek,
      workShifts: mockWorkShifts,
      weekNumber: 45,
      startLabel: '02/11',
      endLabel: '08/11',
      showToast,
    });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [wb, filename] = (XLSX.writeFile as any).mock.calls[0];
    expect(filename).toBe('Lich_lam_viec_Tuan_45_02-11_08-11.xlsx');
    expect(wb.SheetNames).toContain('Tuần 45');
    expect(showToast).not.toHaveBeenCalled();
  });
});
