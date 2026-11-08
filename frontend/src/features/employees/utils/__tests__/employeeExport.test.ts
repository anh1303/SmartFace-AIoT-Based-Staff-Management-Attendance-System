import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildEmployeeExportRows,
  exportEmployeesToExcel,
} from '../employeeExport';
import { Employee } from '@/types';

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return {
    ...actual,
    writeFile: vi.fn(),
  };
});

describe('employeeExport utility', () => {
  const mockEmployees: Employee[] = [
    {
      employee_id: 'NV-001',
      full_name: 'Nguyễn Văn A',
      department: 'Kỹ Thuật',
      position: 'Kỹ sư phần mềm',
      email: 'a@example.com',
      phone: '0123456789',
      created_at: '2026-01-15T08:00:00Z',
      updated_at: '2026-01-15T08:00:00Z',
      hourly_rate: 65000,
      face_enrolled: true,
      fingerprint_enrolled: false,
      status: 'ACTIVE',
    },
    {
      employee_id: 'NV-002',
      full_name: 'Trần Thị B',
      department: 'Nhân Sự',
      position: 'Chuyên viên tuyển dụng',
      email: 'b@example.com',
      phone: '0987654321',
      created_at: '2026-02-20T08:00:00Z',
      updated_at: '2026-02-20T08:00:00Z',
      hourly_rate: 55000,
      face_enrolled: false,
      fingerprint_enrolled: true,
      status: 'INACTIVE',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildEmployeeExportRows formats headers and employee rows properly', () => {
    const { headers, rows } = buildEmployeeExportRows(mockEmployees);

    expect(headers).toEqual([
      'Mã NV',
      'Họ và Tên',
      'Phòng Ban',
      'Chức Vụ',
      'Email',
      'Số Điện Thoại',
      'Ngày Vào Làm',
      'Lương Theo Giờ (VNĐ)',
      'Face ID AI',
      'Vân Tay',
      'Trạng Thái',
    ]);

    expect(rows).toHaveLength(2);

    const row1 = rows[0];
    expect(row1[0]).toBe('NV-001');
    expect(row1[1]).toBe('Nguyễn Văn A');
    expect(row1[2]).toBe('Kỹ Thuật');
    expect(row1[3]).toBe('Kỹ sư phần mềm');
    expect(row1[4]).toBe('a@example.com');
    expect(row1[5]).toBe('0123456789');
    expect(row1[7]).toBe(65000);
    expect(row1[8]).toBe('Đã Đăng Ký');
    expect(row1[9]).toBe('Chưa Đăng Ký');
    expect(row1[10]).toBe('Hoạt động');

    const row2 = rows[1];
    expect(row2[0]).toBe('NV-002');
    expect(row2[8]).toBe('Chưa Đăng Ký');
    expect(row2[9]).toBe('Đã Đăng Ký');
    expect(row2[10]).toBe('Tạm Ngưng');
  });

  it('exportEmployeesToExcel warns when employee list is empty', () => {
    const showToast = vi.fn();
    exportEmployeesToExcel({
      employees: [],
      showToast,
    });

    expect(showToast).toHaveBeenCalledWith(
      'Không có dữ liệu nhân viên để xuất Excel!',
      'error',
      'Không thể xuất danh sách nhân viên'
    );
    expect(XLSX.writeFile).not.toHaveBeenCalled();
  });

  it('exportEmployeesToExcel successfully exports workbook to .xlsx', () => {
    const showToast = vi.fn();
    exportEmployeesToExcel({
      employees: mockEmployees,
      showToast,
      fileName: 'Danh_sach_nhan_su_test.xlsx',
    });

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [wb, fileName] = (XLSX.writeFile as any).mock.calls[0];
    expect(fileName).toBe('Danh_sach_nhan_su_test.xlsx');
    expect(wb.SheetNames).toContain('Danh sách nhân sự');
    expect(showToast).not.toHaveBeenCalled();
  });
});
