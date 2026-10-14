import React, { useState, useMemo } from 'react';
import { CalendarRange } from 'lucide-react';
import { WorkShift, Employee } from '../../../types';
import { formatVNDate, getTodayVNString } from '../../../utils/dateUtils';

interface EmployeeScheduleTabProps {
  currentEmp: Employee;
  employeeShifts: WorkShift[];
}

export const EmployeeScheduleTab: React.FC<EmployeeScheduleTabProps> = ({
  employeeShifts,
}) => {
  const [startDate, setStartDate] = useState<string>(() => {
    const today = getTodayVNString();
    const [y, m] = today.split('-');
    return `${y}-${m}-01`;
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const today = getTodayVNString();
    const [y, m] = today.split('-');
    const lastDayObj = new Date(Number(y), Number(m), 0);
    return `${y}-${m}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
  });
  const [quickPreset, setQuickPreset] = useState<'today' | 'month' | 'all' | 'custom'>('month');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');

  const setQuickRange = (preset: 'today' | 'month' | 'all') => {
    setQuickPreset(preset);
    const today = getTodayVNString();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'month') {
      const [y, m] = today.split('-');
      const firstDay = `${y}-${m}-01`;
      const lastDayObj = new Date(Number(y), Number(m), 0);
      const lastDay = `${y}-${m}-${String(lastDayObj.getDate()).padStart(2, '0')}`;
      setStartDate(firstDay);
      setEndDate(lastDay);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const filteredShifts = useMemo(() => {
    return employeeShifts.filter(shift => {
      if (startDate && shift.date < startDate) return false;
      if (endDate && shift.date > endDate) return false;

      if (shiftFilter !== 'ALL') {
        if (shiftFilter === 'OFFICE_HOURS') {
          if (shift.shift_type !== 'OFFICE_HOURS' && (shift.shift_type as string) !== 'HANH_CHINH') return false;
        } else if (shiftFilter === 'MORNING') {
          if (shift.shift_type !== 'MORNING') return false;
        } else if (shiftFilter === 'AFTERNOON') {
          if (shift.shift_type !== 'AFTERNOON') return false;
        }
      }

      return true;
    });
  }, [employeeShifts, startDate, endDate, shiftFilter]);

  const getDayOfWeekVN = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length < 3) return '';
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    const dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return dayNames[d.getDay()] || '';
  };

  return (
    <div className="space-y-6">
      {/* Bento Filter Header Bar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
              <CalendarRange className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Lịch Phân Ca Làm Việc
            </h2>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickRange('today')}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer ${quickPreset === 'today'
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 font-semibold'
                : 'bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a]'
                }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('month')}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer ${quickPreset === 'month'
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 font-semibold'
                : 'bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a]'
                }`}
            >
              Tháng này
            </button>
            <button
              type="button"
              onClick={() => setQuickRange('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-colors cursor-pointer ${quickPreset === 'all'
                ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 font-semibold'
                : 'bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#272d5a]'
                }`}
            >
              Tất cả
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-3 border-t border-slate-100 dark:border-[#21264b]">
          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Từ ngày
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setQuickPreset('custom');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Đến ngày
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setQuickPreset('custom');
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
              />
            </div>
          </div>

          {/* Shift Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Ca làm
            </label>
            <select
              value={shiftFilter}
              onChange={e => setShiftFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">Tất cả ca làm</option>
              <option value="OFFICE_HOURS">Ca hành chính</option>
              <option value="MORNING">Ca sáng</option>
              <option value="AFTERNOON">Ca chiều</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedule Table */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-300 dark:border-[#28305c] rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Thứ</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Ngày làm việc</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Ca làm việc</th>
                <th className="py-3.5 px-4 text-center">Ghi chú</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    {employeeShifts.length === 0
                      ? 'Chưa có ca làm việc nào được phân công.'
                      : 'Không có ca làm việc nào trong khoảng thời gian đã chọn.'}
                  </td>
                </tr>
              ) : (
                filteredShifts.map((shift, idx) => (
                  <tr key={shift.shift_id || idx} className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b border-slate-200 dark:border-[#202752]">
                    <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200 border-r border-slate-200 dark:border-[#202752]">
                      {shift.work_day || getDayOfWeekVN(shift.date)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white border-r border-slate-200 dark:border-[#202752]">
                      {formatVNDate(shift.date)}
                    </td>
                    <td className="py-3.5 px-4 border-r border-slate-200 dark:border-[#202752]">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {shift.shift_type === 'MORNING'
                            ? 'Ca sáng'
                            : shift.shift_type === 'AFTERNOON'
                              ? 'Ca chiều'
                              : shift.shift_type === 'OFF'
                                ? 'Nghỉ phép'
                                : 'Ca hành chính'}
                        </span>
                        {shift.shift_type !== 'OFF' && shift.start_time && shift.end_time && (
                          <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                            ({shift.start_time} – {shift.end_time})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {shift.note || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
