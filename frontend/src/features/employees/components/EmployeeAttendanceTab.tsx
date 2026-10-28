import { AttendanceDayDetails, AttendanceLogFilterSelect, type AttendanceLogFilter } from '../../attendances/components/AttendanceDayDetails';
import { AdjustmentReviewPanel } from '../../payrolls/components/AdjustmentReviewPanel';
import React, { useMemo, useState, useId } from 'react';
import { Clock } from 'lucide-react';
import { AttendanceRecord, Employee } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { useAttendance, useAttendancePairs, useAttendanceSummaries, AttendanceStats } from '@/features/attendances';

interface EmployeeAttendanceTabProps {
  currentEmp?: Employee;
  startDate: string;
  endDate: string;
  setStartDate: (d: string) => void;
  setEndDate: (d: string) => void;
  quickPreset: 'today' | 'month' | 'all' | 'custom';
  setQuickRange: (preset: 'today' | 'month' | 'all') => void;
  setQuickPreset: (p: 'today' | 'month' | 'all' | 'custom') => void;
  attendanceTypeFilter: string;
  setAttendanceTypeFilter: (t: string) => void;
  attendanceStatusFilter: string;
  setAttendanceStatusFilter: (s: string) => void;
  attendanceStats: AttendanceStats;
  employeeAttendanceLogs: AttendanceRecord[];
}

export const EmployeeAttendanceTab: React.FC<EmployeeAttendanceTabProps> = ({
  currentEmp,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  quickPreset,
  setQuickRange,
  setQuickPreset,
  attendanceTypeFilter,
  setAttendanceTypeFilter,
  attendanceStatusFilter,
  setAttendanceStatusFilter,
  attendanceStats,
  employeeAttendanceLogs
}) => {
  const { workShifts, employees } = useApp();
  const fieldId=useId();
  const [logFilter, setLogFilter] = useState<AttendanceLogFilter>('ALL');
  const logsQuery = useAttendance({ employeeId: currentEmp?.employee_id, startDate: startDate || undefined, endDate: endDate || undefined, fetchAllPages: true });
  const attendance = logsQuery.attendance;

  const targetEmployees = useMemo(() => {
    if (currentEmp) return [currentEmp];
    return employees;
  }, [currentEmp, employees]);

  // Adjacent summaries identify checkout events owned by an overnight shift
  // outside the selected work-date range, without re-pairing in the browser.
  const summaryStart = startDate ? new Date(+new Date(`${startDate}T00:00:00Z`) - 86400000).toISOString().slice(0,10) : undefined;
  const summaryEnd = endDate ? new Date(+new Date(`${endDate}T00:00:00Z`) + 86400000).toISOString().slice(0,10) : undefined;
  const summariesQuery = useAttendanceSummaries(
    summaryStart,
    summaryEnd,
    currentEmp?.employee_id
  );
  const { customOvertimeMap, customLateEarlyMap, workingHoursMap, summaryMap } = summariesQuery;

  const employeePairs = useAttendancePairs(
    targetEmployees,
    workShifts,
    attendance,
    startDate,
    endDate,
    '',
    attendanceStatusFilter,
    customOvertimeMap,
    customLateEarlyMap,
    'ALL',
    'ALL',
    workingHoursMap,
    summaryMap
  );

  // Chỉ hiển thị khi đã chấm công ít nhất 1 lần trong ca
  const recordedPairs = useMemo(() => {
    return employeePairs.filter((item) => {
      const hasAttendance = item.rawEvents.length > 0;
      if (!hasAttendance) return false;

      if (attendanceTypeFilter === 'CHECK_IN' && !item.rawEvents.some(e => e.type === 'CHECK_IN')) return false;
      if (attendanceTypeFilter === 'CHECK_OUT' && !item.rawEvents.some(e => e.type === 'CHECK_OUT')) return false;

      return true;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [employeePairs, attendanceTypeFilter]);
  return (
    <div className="space-y-6">
      {/* Bento Filter Header Bar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Nhật Ký Chấm Công
            </h2>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickRange('today')}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer ${quickPreset === 'today'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 font-semibold'
                : 'bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a]'
                }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('month')}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer ${quickPreset === 'month'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 font-semibold'
                : 'bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a]'
                }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer ${quickPreset === 'all'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50 font-semibold'
                : 'bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a]'
                }`}
            >
              Tất cả
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-[#21264b]">
          {/* Start Date */}
          <div>
            <label htmlFor={`${fieldId}-start`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Từ ngày
            </label>
            <div className="relative">
              <input id={`${fieldId}-start`}
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setQuickPreset('custom');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label htmlFor={`${fieldId}-end`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Đến ngày
            </label>
            <div className="relative">
              <input id={`${fieldId}-end`}
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setQuickPreset('custom');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          {/* Event Type Filter */}
          <div>
            <label htmlFor={`${fieldId}-type`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Sự kiện
            </label>
            <select id={`${fieldId}-type`}
              value={attendanceTypeFilter}
              onChange={e => setAttendanceTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">Tất cả sự kiện</option>
              <option value="CHECK_IN">Vào ca</option>
              <option value="CHECK_OUT">Hết ca</option>
            </select>
          </div>

          {/* Punctuality Status Filter */}
          <div>
            <label htmlFor={`${fieldId}-status`} className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Trạng thái
            </label>
            <select id={`${fieldId}-status`}
              value={attendanceStatusFilter}
              onChange={e => setAttendanceStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ON_TIME">Đúng giờ</option>
              <option value="LATE">Đi muộn</option>
              <option value="EARLY_LEAVE">Về sớm</option>
            </select>
          </div>
        </div>
      </div>

      <div className="sf-summary" aria-label="Tổng hợp trong khoảng đã chọn">
        <span><strong>{attendanceStats.workDays}</strong> ngày làm việc</span>
        <span><strong>{attendanceStats.totalLogs}</strong> lượt quét · {attendanceStats.checkIns} vào / {attendanceStats.checkOuts} ra</span>
        <span><strong>{attendanceStats.lateCount + attendanceStats.earlyLeaveCount}</strong> lượt trễ / sớm</span>
        <span>Điểm xác thực TB: <strong>{attendanceStats.avgConfidence}%</strong></span>
      </div>

      {currentEmp && <details className="sf-panel p-4"><summary className="font-semibold">Các khoản OT & phạt trong kỳ · Xem và đối chiếu</summary><div className="mt-5"><AdjustmentReviewPanel period={(startDate || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })).slice(0,7)} employeeId={currentEmp.employee_id} /></div></details>}
      <section className="space-y-3">
        <h3 className="font-bold text-slate-900 dark:text-white">Chi tiết các lượt vào / ra theo ngày</h3>
        <AttendanceLogFilterSelect value={logFilter} onChange={setLogFilter} />
        {(logsQuery.isLoading || summariesQuery.isLoading) && <p role="status">Đang tải lịch sử và kết quả công…</p>}
        {(logsQuery.isError || summariesQuery.isError) && <p role="alert" className="text-rose-600">Không tải đủ dữ liệu chấm công. <button type="button" onClick={() => { logsQuery.refetchAttendance(); summariesQuery.refetch(); }}>Thử lại</button></p>}
        {recordedPairs.length === 0 && !logsQuery.isLoading && <p className="text-sm text-slate-500">Không có lượt ghi nhận trong khoảng đã chọn.</p>}
        {recordedPairs.map((item,index) => <details open={index === 0} key={`${item.employee.employee_id}-${item.date}`} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#13162b] p-4">
          <summary className="cursor-pointer font-semibold text-slate-900 dark:text-white">
            <span className="inline-flex flex-wrap items-center justify-between gap-3 w-[95%]"><span>{item.date}<span className="sf-secondary block">{item.shift.name} · {item.shift.timeRange}</span></span><span className="flex flex-wrap items-center gap-3 text-sm"><span className="text-slate-500 font-normal">{item.rawEvents.length} lượt quét</span><span className="sf-badge blue">{item.workingHours} giờ công</span>{item.needsReview && <span className="sf-badge warning">Cần xác minh</span>}</span></span>
          </summary>
          <div className="mt-4"><AttendanceDayDetails item={item} filter={logFilter} showFilter={false} /></div>
        </details>)}
      </section>
    </div>
  );
};
