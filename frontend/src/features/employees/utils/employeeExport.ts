import { Employee } from '@/types';
import { exportToExcel } from '@/utils/excelExport';

export const buildEmployeeExportRows = (
  employees: Employee[]
): { headers: string[]; rows: (string | number)[][] } => {
  const headers = [
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
  ];

  const rows = employees.map((emp) => {
    let joinDateStr = '';
    if (emp.created_at) {
      const d = new Date(emp.created_at);
      if (!isNaN(d.getTime())) {
        joinDateStr = d.toLocaleDateString('vi-VN');
      }
    }

    return [
      emp.employee_id,
      emp.full_name,
      emp.department || '',
      emp.position || 'Nhân viên',
      emp.email || '',
      emp.phone || '',
      joinDateStr,
      emp.hourly_rate || 0,
      emp.face_enrolled ? 'Đã Đăng Ký' : 'Chưa Đăng Ký',
      emp.fingerprint_enrolled ? 'Đã Đăng Ký' : 'Chưa Đăng Ký',
      emp.status === 'ACTIVE' ? 'Hoạt động' : 'Tạm Ngưng',
    ];
  });

  return { headers, rows };
};

export interface ExportEmployeesOptions {
  employees: Employee[];
  format?: 'excel' | 'pdf';
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  fileName?: string;
}

export const exportEmployeesToExcel = ({
  employees,
  showToast,
  format = 'excel',
  fileName,
}: ExportEmployeesOptions): void => {
  if (!employees || employees.length === 0) {
    showToast?.('Không có dữ liệu nhân viên để xuất Excel!', 'warning');
    return;
  }

  const { headers, rows } = buildEmployeeExportRows(employees);
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetFileName = fileName || `Danh_sach_nhan_su_${todayStr}.xlsx`;

  void exportToExcel({
    format,
    sheetName: 'Danh sách nhân sự',
    headers,
    rows,
    fileName: targetFileName,
  }).then(saved => { if (saved) showToast?.('Đã lưu danh sách nhân sự sang file Excel (.xlsx)!', 'success'); })
    .catch(() => showToast?.('Không thể lưu báo cáo.', 'error'));
};

