import { exportToExcel } from '@/utils/excelExport';

export interface EmployeePairExportItem {
  employee: { employee_id: string; full_name: string; department: string };
  shift: { name: string; timeRange: string };
  events: Array<{ time: string; methodLabel: string; device_id: string; statusText: string }>;
  lateEarlyStr?: string;
  overtimeStr?: string;
  date?: string;
}

export const exportAttendanceToExcel = (
  employeePairs: EmployeePairExportItem[],
  dateLabel: string,
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void,
  format: 'excel' | 'pdf' = 'excel'
) => {
  const headers = [
    'Mã NV',
    'Họ Tên',
    'Phòng Ban',
    'Ngày',
    'Ca Làm Việc',
    'Khung Giờ Ca',
    'Loại SK',
    'Thời Gian Ghi Nhận',
    'Phương Thức',
    'Thiết Bị',
    'Trạng Thái',
    'Trễ/Sớm',
    'Tăng Ca',
  ];

  const rows: (string | number)[][] = [];

  employeePairs.forEach((item) => {
    const emp = item.employee;
    const shift = item.shift;
    const checkIn = item.events[0];
    const checkOut = item.events[1];
    const lateEarlyStr = item.lateEarlyStr || '00:00:00';
    const overtimeStr = item.overtimeStr || '00:00:00';
    const rowDate = item.date || dateLabel;

    rows.push([
      emp.employee_id,
      emp.full_name,
      emp.department,
      rowDate,
      shift.name,
      shift.timeRange,
      'CHECK_IN',
      checkIn?.time || '',
      checkIn?.methodLabel || '',
      checkIn?.device_id || '',
      checkIn?.statusText || '',
      lateEarlyStr,
      overtimeStr,
    ]);

    rows.push([
      emp.employee_id,
      emp.full_name,
      emp.department,
      rowDate,
      shift.name,
      shift.timeRange,
      'CHECK_OUT',
      checkOut?.time || '',
      checkOut?.methodLabel || '',
      checkOut?.device_id || '',
      checkOut?.statusText || '',
      lateEarlyStr,
      overtimeStr,
    ]);
  });

  const safeFilenameDate = dateLabel.replace(/[^\w.-]/g, '_');
  return exportToExcel({
    format,
    sheetName: 'Báo cáo điểm danh',
    headers,
    rows,
    fileName: `Bao_cao_cham_cong_${safeFilenameDate}.xlsx`,
  }).then(saved => { if (saved) showToast(`Đã lưu báo cáo chấm công sang file Excel (${dateLabel})!`, 'success', "Xuất báo cáo chấm công thành công"); })
    .catch(() => showToast('Không thể lưu báo cáo.', 'error', "Không thể xuất báo cáo chấm công"));
};

// Alias giữ lại để tương thích ngược với các file gọi cũ
export const exportAttendanceToCSV = exportAttendanceToExcel;
