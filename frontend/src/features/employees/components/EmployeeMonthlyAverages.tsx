import { useApp } from '../../../context/AppContext';
import { useShiftContext } from '../../../context/ShiftContext';
import { useAttendanceSummaries } from '../../attendances/hooks/useAttendanceSummaries';
import { getTodayVNString } from '../../../utils/dateUtils';
import { Employee } from '../../../types';
import { calculateMonthlyAverages } from '../utils/monthlyAverages';

export function EmployeeMonthlyAverages({ employee }: { employee: Employee }) {
  const { payroll, isLoadingPayroll, payrollError } = useApp();
  const shifts = useShiftContext();
  const attendance = useAttendanceSummaries(undefined, undefined, employee.employee_id);
  const belongsToEmployee = (id: string) => id === employee.employee_id || id === employee.id;
  const averages = calculateMonthlyAverages(
    shifts.workShifts.filter(row => belongsToEmployee(row.employee_id)),
    attendance.summaries,
    payroll.filter(row => belongsToEmployee(row.employee_id)),
    getTodayVNString().slice(0, 7),
  );
  const items = [
    { label: 'Ca làm việc', value: averages.shifts, unit: 'ca', loading: shifts.isLoading, error: shifts.isError },
    { label: 'Tổng giờ làm', value: averages.hours, unit: 'giờ', loading: attendance.isLoading, error: attendance.isError },
    { label: 'Tỷ lệ đúng giờ', value: averages.punctuality, unit: '%', loading: attendance.isLoading, error: attendance.isError },
    { label: 'Tăng ca', value: averages.overtime, unit: 'giờ', loading: attendance.isLoading, error: attendance.isError },
    { label: 'Đi trễ / Về sớm', value: averages.lateEarly, unit: 'giờ', loading: attendance.isLoading, error: attendance.isError },
    { label: 'Nghỉ làm', value: averages.absence, unit: 'ngày', loading: attendance.isLoading, error: attendance.isError },
    { label: 'Lương', value: averages.salary, unit: 'đ', loading: isLoadingPayroll, error: Boolean(payrollError) },
  ];
  return <section className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs">
    <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-[#0f1224]/70 border-b border-slate-100 dark:border-[#21264b]">
      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">Đánh giá chung (trung bình trên một tháng)</h3>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 divide-slate-100 dark:divide-[#21264b]">
      {items.map(item => <div key={item.label} className="p-4 border-b border-r border-slate-100 dark:border-[#21264b]">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</div>
        <div className="mt-3 font-mono font-bold text-lg text-slate-900 dark:text-white">
          {item.loading ? '…' : item.error ? 'Lỗi tải' : item.value === null ? '—' : <>{item.value.toLocaleString('vi-VN', { maximumFractionDigits: item.unit === 'đ' ? 0 : 1 })} <span className="text-xs text-slate-500">{item.unit}</span></>}
        </div>
      </div>)}
    </div>
  </section>;
}
