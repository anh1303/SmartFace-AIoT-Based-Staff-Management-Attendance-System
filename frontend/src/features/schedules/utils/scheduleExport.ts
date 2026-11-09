import { Employee, WorkShift } from '@/types';
import { DayOfWeekItem } from '../components/ScheduleMatrixTable';
import { calculateShiftWorkingHours } from '@/utils/timeUtils';
import { exportToExcel } from '@/utils/excelExport';

export interface ExportScheduleOptions {
  filteredEmployees: Employee[];
  daysOfWeek: DayOfWeekItem[];
  workShifts: WorkShift[];
  weekNumber: number;
  startLabel: string;
  endLabel: string;
  format?: 'excel' | 'pdf';
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning', title?: string) => void;
}

export const employeesWithScheduledShifts = (employees: Employee[], days: DayOfWeekItem[], shifts: WorkShift[]): Employee[] => {
  const dates = new Set(days.map(day => day.date));
  const ids = new Set(shifts.filter(shift => dates.has(shift.date) && shift.shift_type !== 'OFF').map(shift => shift.employee_id));
  return employees.filter(employee => ids.has(employee.employee_id));
};

export const getShiftTypeLabel = (shiftType: WorkShift['shift_type']): string => {
  switch (shiftType) {
    case 'OFFICE_HOURS':
      return 'Hành chính';
    case 'MORNING':
      return 'Ca Sáng';
    case 'AFTERNOON':
      return 'Ca Chiều';
    case 'OTHER':
      return 'Ca khác';
    default:
      return 'Nghỉ ca';
  }
};

/**
 * Xây dựng headers và các dòng dữ liệu dạng bảng ma trận tuần
 */
export const buildScheduleMatrixData = (
  employees: Employee[],
  daysOfWeek: DayOfWeekItem[],
  workShifts: WorkShift[]
): { headers: string[]; rows: (string | number)[][] } => {
  const headers = [
    'Mã NV',
    'Họ và Tên',
    'Phòng ban',
    'Chức vụ',
    ...daysOfWeek.map((d) => `${d.name} (${d.label})`),
    'Tổng Ca Làm',
    'Tổng Giờ Dự Kiến (giờ)',
  ];

  const rows = employees.map((emp) => {
    let totalShifts = 0;
    let totalHours = 0;

    const dayCells = daysOfWeek.map((d) => {
      const shift = workShifts.find(
        (s) => s.employee_id === emp.employee_id && s.date === d.date
      );

      if (!shift || shift.shift_type === 'OFF') {
        return 'Nghỉ ca';
      }

      totalShifts += 1;
      const hours = calculateShiftWorkingHours({
        start_time: shift.start_time,
        end_time: shift.end_time,
      });
      totalHours += hours;

      const typeLabel = getShiftTypeLabel(shift.shift_type);
      let text = `${typeLabel} (${shift.start_time} - ${shift.end_time})`;
      if (shift.note && shift.note.trim()) {
        text += ` [${shift.note.trim()}]`;
      }
      return text;
    });

    const roundedHours = Math.round(totalHours * 100) / 100;

    return [
      emp.employee_id,
      emp.full_name,
      emp.department || '',
      emp.position || 'Nhân viên',
      ...dayCells,
      totalShifts,
      roundedHours,
    ];
  });

  return { headers, rows };
};

/**
 * Tự động tính toán độ rộng tối ưu cho từng cột để Excel hiển thị gọn gàng.
 * Với các cột ngày trong tuần: chỉ tính độ rộng vừa đủ hiển thị tên ca và giờ làm,
 * bỏ qua phần chú thích [...] để bảng không bị kéo giãn quá rộng theo chiều ngang.
 * Người dùng muốn xem chú thích có thể kéo mở rộng cột thủ công hoặc xem trên thanh công thức (fx).
 */
export const calculateAutoFitColumnWidths = (
  headers: string[],
  rows: (string | number)[][],
  dayColStartIndex: number = 4,
  dayColCount: number = 7
): { wch: number }[] => {
  return headers.map((header, colIdx) => {
    let maxLen = header.length;
    const isDayCol = colIdx >= dayColStartIndex && colIdx < dayColStartIndex + dayColCount;

    rows.forEach((row) => {
      const val = row[colIdx];
      if (val !== undefined && val !== null) {
        let strVal = String(val);
        if (isDayCol && strVal.includes(' [')) {
          strVal = strVal.split(' [')[0];
        }
        const len = strVal.length;
        if (len > maxLen) {
          maxLen = len;
        }
      }
    });
    // Thêm khoảng đệm 3 ký tự, tối thiểu rộng 12 ký tự
    return { wch: Math.max(maxLen + 3, 12) };
  });
};

/**
 * Xuất dữ liệu ma trận lịch làm việc tuần ra file Excel (.xlsx)
 */
export const exportScheduleToExcel = ({
  filteredEmployees,
  daysOfWeek,
  workShifts,
  weekNumber,
  startLabel,
  endLabel,
  showToast,
  format = 'excel',
}: ExportScheduleOptions): Promise<unknown> | undefined => {
  const scheduledEmployees = employeesWithScheduledShifts(filteredEmployees, daysOfWeek, workShifts);
  if (scheduledEmployees.length === 0) {
    showToast?.(filteredEmployees.length === 0 ? 'Không có dữ liệu nhân viên để xuất Excel!' : 'Không có nhân viên có ca làm việc trong tuần để xuất Excel!', 'error', "Không thể xuất lịch làm việc");
    return;
  }

  const { headers, rows } = buildScheduleMatrixData(
    scheduledEmployees,
    daysOfWeek,
    workShifts
  );

  const colWidths = calculateAutoFitColumnWidths(headers, rows, 4, daysOfWeek.length);

  const safeStart = startLabel.replace(/[\/\\]/g, '-');
  const safeEnd = endLabel.replace(/[\/\\]/g, '-');
  const filename = `Lich_lam_viec_Tuan_${weekNumber}_${safeStart}_${safeEnd}.xlsx`;

  return exportToExcel({
    format,
    sheetName: `Tuần ${weekNumber}`,
    headers,
    rows,
    fileName: filename,
    colWidths,
  }).then(saved => { if (saved) showToast?.(`Đã lưu lịch làm việc Tuần ${weekNumber} (${startLabel} - ${endLabel}) sang file Excel!`, 'success', "Xuất lịch làm việc thành công"); })
    .catch(() => showToast?.('Không thể lưu báo cáo.', 'error', "Không thể xuất lịch làm việc"));
};

