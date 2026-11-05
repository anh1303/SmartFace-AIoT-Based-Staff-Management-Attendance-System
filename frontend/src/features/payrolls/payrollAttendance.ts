import { BackendAttendanceSummaryItem } from '../attendances/hooks/useAttendanceSummaries';
import { WorkShift } from '../../types';

export function payrollAttendanceTotals(summaries: BackendAttendanceSummaryItem[], shifts: WorkShift[], period?: string) {
  const totals = new Map<string, number>();
  const workingDays = new Set(
    shifts
      .filter(shift => shift.shift_type !== 'OFF' && (!period || shift.date.startsWith(period)))
      .map(shift => `${shift.employee_id}_${shift.date}`)
  );
  for (const summary of summaries) {
    if (period && !summary.date.startsWith(period)) continue;
    const scheduled = workingDays.has(`${summary.employee_id}_${summary.date}`) || (summary.employee_uuid && workingDays.has(`${summary.employee_uuid}_${summary.date}`));
    // Chỉ tính vào số ca nghỉ làm của bảng lương khi:
    // 1. Trạng thái ngày công là ABSENT và có xếp ca làm việc
    // 2. Ngày công đó đã được Quản lý/Hệ thống duyệt chốt (review_status === 'APPROVED')
    //    (Bỏ qua các ngày chưa duyệt như 'NONE', 'PENDING' để đồng bộ tuyệt đối với số liệu tính lương của Backend)
    const isApproved = summary.review_status === 'APPROVED' || summary.review_status === undefined;
    const isCounted = summary.status === 'ABSENT' && scheduled && isApproved;
    totals.set(summary.employee_id, (totals.get(summary.employee_id) ?? 0) + (isCounted ? 1 : 0));
  }
  return totals;
}
