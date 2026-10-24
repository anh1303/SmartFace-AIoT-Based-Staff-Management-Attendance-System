import React, { useMemo } from 'react';
import {
  Clock,
  ScanFace,
  Fingerprint
} from 'lucide-react';
import { AttendanceRecord, Employee } from '../../../types';
import { useApp } from '../../../context/AppContext';
import { useAttendancePairs } from '../../../hooks/useAttendancePairs';
import { getStatusBadge } from '../../../utils/timeUtils';
import {
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableEmpty
} from '../../../components/common';

interface AttendanceStats {
  totalLogs: number;
  checkIns: number;
  checkOuts: number;
  workDays: number;
  lateCount: number;
  earlyLeaveCount: number;
  avgConfidence: number;
}

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
  const { workShifts, attendance, employees } = useApp();

  const targetEmployees = useMemo(() => {
    if (currentEmp) return [currentEmp];
    return employees;
  }, [currentEmp, employees]);

  const employeePairs = useAttendancePairs(
    targetEmployees,
    workShifts,
    attendance,
    startDate,
    endDate,
    '',
    attendanceStatusFilter,
    {},
    {}
  );

  // Chỉ hiển thị khi đã chấm công ít nhất 1 lần trong ca
  const recordedPairs = useMemo(() => {
    return employeePairs.filter((item) => {
      const hasAttendance = item.hasCheckedIn || item.hasCheckedOut;
      if (!hasAttendance) return false;

      if (attendanceTypeFilter === 'CHECK_IN' && !item.hasCheckedIn) return false;
      if (attendanceTypeFilter === 'CHECK_OUT' && !item.hasCheckedOut) return false;

      return true;
    });
  }, [employeePairs, attendanceTypeFilter]);
  return (
    <div className="space-y-6">
      {/* Bento Filter Header Bar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 shadow-xs space-y-4 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-heading flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Nhật Ký Chấm Công
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-[#21264b]">
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

          {/* Event Type Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Sự kiện
            </label>
            <select
              value={attendanceTypeFilter}
              onChange={e => setAttendanceTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">Tất cả sự kiện</option>
              <option value="CHECK_IN">Vào ca</option>
              <option value="CHECK_OUT">Hết ca</option>
            </select>
          </div>

          {/* Punctuality Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Trạng thái
            </label>
            <select
              value={attendanceStatusFilter}
              onChange={e => setAttendanceStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ON_TIME">Đúng giờ</option>
              <option value="LATE">Đi muộn</option>
              <option value="EARLY_LEAVE">Về sớm</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4 Stats Cards in Date Range */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Số ngày làm việc */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs flex flex-col justify-between gap-2 transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">Số ngày làm việc</span>
          <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
            {attendanceStats.workDays} <span className="text-sm font-normal text-slate-500">ngày</span>
          </p>
        </div>

        {/* Card 2: Tổng số lượt chấm công */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs flex flex-col justify-between gap-2 transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">Tổng số lượt chấm công</span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white flex items-baseline gap-1.5 flex-wrap">
            <span>{attendanceStats.totalLogs}</span>
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400 font-sans">
              ({attendanceStats.checkIns} Check-in • {attendanceStats.checkOuts} Check-out)
            </span>
          </p>
        </div>

        {/* Card 3: Đi muộn / Về sớm */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs flex flex-col justify-between gap-2 transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">Đi muộn / Về sớm</span>
          <p className="text-2xl font-bold font-mono text-amber-500">
            {attendanceStats.lateCount + attendanceStats.earlyLeaveCount} <span className="text-sm font-normal text-slate-500">lần</span>
          </p>
        </div>

        {/* Card 4: Độ tin cậy AI trung bình */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] shadow-xs flex flex-col justify-between gap-2 transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400">Độ tin cậy AI trung bình</span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{attendanceStats.avgConfidence}%</p>
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            Bản ghi chấm công ({recordedPairs.length} ca làm việc)
          </span>
        </div>

        <TableContainer minWidth="900px">
          <TableHead>
            <TableHeadRow>
              <TableHeadCell width="150px">Ca làm việc</TableHeadCell>
              <TableHeadCell width="120px">Sự kiện</TableHeadCell>
              <TableHeadCell width="100px">Thời gian</TableHeadCell>
              <TableHeadCell width="130px">Phương thức</TableHeadCell>
              <TableHeadCell width="90px">Độ tin cậy</TableHeadCell>
              <TableHeadCell width="110px">Trạng thái</TableHeadCell>
              <TableHeadCell width="100px">Trễ / Sớm</TableHeadCell>
              <TableHeadCell width="100px" isLast>Tăng ca</TableHeadCell>
            </TableHeadRow>
          </TableHead>
          <TableBody>
            {recordedPairs.length === 0 ? (
              <TableEmpty
                colSpan={8}
                message={`Không tìm thấy bản ghi chấm công nào phù hợp ${
                  startDate === endDate ? `cho ngày ${startDate}` : `trong khoảng từ ${startDate} đến ${endDate}`
                }`}
              />
            ) : (
              recordedPairs.map((item) => {
                const { shift, events, lateEarlyStr, overtimeStr } = item;
                const checkInEv = events[0];
                const checkOutEv = events[1];

                const inBadge = getStatusBadge(checkInEv.status);
                const outBadge = getStatusBadge(checkOutEv.status);

                return (
                  <React.Fragment key={`${item.employee.employee_id}-${item.date}-${shift.name}`}>
                    {/* Row 1: Check-in */}
                    <tr className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b border-slate-200 dark:border-[#202752]">
                      {/* Shift Info - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-middle text-center border-r border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b] max-w-[150px]">
                        <div className="space-y-1 flex flex-col items-center justify-center text-center">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/40 text-[10px] font-mono font-semibold text-purple-600 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/40 truncate max-w-full"
                            title={item.date}
                          >
                            {item.date}
                          </span>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-xs w-full" title={shift.name}>
                            {shift.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate w-full" title={shift.timeRange}>
                            {shift.timeRange}
                          </p>
                        </div>
                      </td>

                      {/* Check-In Event */}
                      <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                          {checkInEv.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkInEv.time}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkInEv.methodLabel === 'UNRECORDED' ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge('UNRECORDED').color}`}>
                            UNRECORDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            {checkInEv.isFace ? (
                              <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {checkInEv.methodLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkInEv.score !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{(checkInEv.score * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${inBadge.color}`}>
                          {inBadge.label}
                        </span>
                      </td>

                      {/* Late/Early - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-middle font-mono font-bold border-r border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b] text-center truncate" title={item.currentLateEarlySec > 0 ? lateEarlyStr : '00:00:00'}>
                        {item.currentLateEarlySec > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">{lateEarlyStr}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">00:00:00</span>
                        )}
                      </td>

                      {/* Overtime - rowSpan 2 */}
                      <td rowSpan={2} className="py-3 px-4 align-middle font-mono font-bold border-b-2 border-slate-300 dark:border-[#28305c] bg-white dark:bg-[#13162b] text-center truncate" title={overtimeStr}>
                        {item.currentOTSec > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">{overtimeStr}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">{overtimeStr}</span>
                        )}
                      </td>
                    </tr>

                    {/* Row 2: Check-out */}
                    <tr className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b-2 border-slate-300 dark:border-[#28305c]">
                      <td className="py-2.5 px-4 font-medium text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className="inline-flex items-center justify-center gap-1.5 text-purple-600 dark:text-purple-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400" />
                          {checkOutEv.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 dark:text-white border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkOutEv.time}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkOutEv.methodLabel === 'UNRECORDED' ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getStatusBadge('UNRECORDED').color}`}>
                            UNRECORDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                            {checkOutEv.isFace ? (
                              <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            ) : (
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            )}
                            {checkOutEv.methodLabel}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] border-r border-slate-200 dark:border-[#202752] text-center">
                        {checkOutEv.score !== null ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{(checkOutEv.score * 100).toFixed(0)}%</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">--</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 border-r border-slate-200 dark:border-[#202752] text-center">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${outBadge.color}`}>
                          {outBadge.label}
                        </span>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </TableContainer>
      </div>
    </div>
  );
};
