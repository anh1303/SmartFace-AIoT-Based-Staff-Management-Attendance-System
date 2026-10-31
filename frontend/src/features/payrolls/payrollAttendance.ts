import { BackendAttendanceSummaryItem } from '../attendances/hooks/useAttendanceSummaries';
import { WorkShift } from '../../types';

export function payrollAttendanceTotals(summaries: BackendAttendanceSummaryItem[], shifts: WorkShift[]) {
  const totals = new Map<string, number>();
  const workingDays = new Set(shifts.filter(shift => shift.shift_type !== 'OFF').map(shift => `${shift.employee_id}_${shift.date}`));
  for (const summary of summaries) {
    const scheduled = workingDays.has(`${summary.employee_id}_${summary.date}`) || (summary.employee_uuid && workingDays.has(`${summary.employee_uuid}_${summary.date}`));
    totals.set(summary.employee_id, (totals.get(summary.employee_id) ?? 0) + (summary.status === 'ABSENT' && scheduled ? 1 : 0));
  }
  return totals;
}
