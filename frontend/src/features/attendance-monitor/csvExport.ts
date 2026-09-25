export interface EmployeePairExportItem {
  employee: { employee_id: string; full_name: string; department: string };
  shift: { name: string; timeRange: string };
  events: Array<{ time: string; methodLabel: string; device_id: string; statusText: string }>;
  lateEarlyStr?: string;
  overtimeStr?: string;
}

export const exportAttendanceToCSV = (
  employeePairs: EmployeePairExportItem[],
  selectedDate: string,
  showToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
) => {
  const headers = [
    'Mã NV',
    'Họ Tên',
    'Chức vụ',
    'Ngày',
    'Ca Làm Việc',
    'Khung Giờ Ca',
    'Loại SK',
    'Thời Gian Ghi Nhận',
    'Phương Thức',
    'Thiết Bị',
    'Trạng Thái',
    'Trễ/Sớm',
    'Tăng Ca'
  ];

  const rows: string[] = [];

  employeePairs.forEach(item => {
    const emp = item.employee;
    const shift = item.shift;
    const checkIn = item.events[0];
    const checkOut = item.events[1];
    const lateEarlyStr = item.lateEarlyStr || '00:00:00';
    const overtimeStr = item.overtimeStr || '00:00:00';

    rows.push([
      `"${emp.employee_id}"`,
      `"${emp.full_name}"`,
      `"${emp.department}"`,
      `"${selectedDate}"`,
      `"${shift.name}"`,
      `"${shift.timeRange}"`,
      `"CHECK_IN"`,
      `"${checkIn.time}"`,
      `"${checkIn.methodLabel}"`,
      `"${checkIn.device_id}"`,
      `"${checkIn.statusText}"`,
      `"${lateEarlyStr}"`,
      `"${overtimeStr}"`
    ].join(','));

    rows.push([
      `"${emp.employee_id}"`,
      `"${emp.full_name}"`,
      `"${emp.department}"`,
      `"${selectedDate}"`,
      `"${shift.name}"`,
      `"${shift.timeRange}"`,
      `"CHECK_OUT"`,
      `"${checkOut.time}"`,
      `"${checkOut.methodLabel}"`,
      `"${checkOut.device_id}"`,
      `"${checkOut.statusText}"`,
      `"${lateEarlyStr}"`,
      `"${overtimeStr}"`
    ].join(','));
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCaoChamCong_${selectedDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast(`Đã xuất báo cáo CSV thành công cho ngày ${selectedDate}!`, 'success');
};
