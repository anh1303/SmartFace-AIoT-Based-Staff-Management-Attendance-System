import React from 'react';
import {
  Clock,
  ScanFace,
  Fingerprint
} from 'lucide-react';
import { AttendanceRecord } from '../../../types';
import { formatVNDate, formatVNTime } from '../../../utils/dateUtils';

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
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="p-4 bg-slate-50/70 dark:bg-[#0f1224]/70 border-b border-slate-100 dark:border-[#21264b] flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
            Bản ghi chấm công ({employeeAttendanceLogs.length} kết quả)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 dark:border-[#28305c] bg-slate-200 dark:bg-[#0c0f1f] text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Thời gian</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Sự kiện</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Phương thức</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Thiết bị AIoT</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Điểm AI</th>
                <th className="py-3.5 px-4 border-r border-slate-300 dark:border-[#222956] text-center">Tuân thủ giờ</th>
                <th className="py-3.5 px-4 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {employeeAttendanceLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    Không có bản ghi chấm công nào trong khoảng thời gian đã chọn.
                  </td>
                </tr>
              ) : (
                employeeAttendanceLogs.map((log, index) => {
                  const isCheckIn = log.type === 'CHECK_IN';
                  const score = Number(log.verification_score || 0.98);
                  const isFace = log.method === 'FACE' || !log.method;

                  return (
                    <tr key={log.attendance_id || log.id || index} className="hover:bg-slate-50/90 dark:hover:bg-[#1a1e3a]/50 transition-colors border-b border-slate-200 dark:border-[#202752]">
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 font-mono border-r border-slate-200 dark:border-[#202752]">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {formatVNTime(log.timestamp, true)}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">
                          {formatVNDate(log.timestamp)}
                        </p>
                      </td>

                      {/* Event Type */}
                      <td className="py-3.5 px-4 border-r border-slate-200 dark:border-[#202752]">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${isCheckIn
                            ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50'
                            : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50'
                            }`}
                        >
                          <Clock className="w-3 h-3" />
                          {isCheckIn ? 'VÀO CA (IN)' : 'TAN CA (OUT)'}
                        </span>
                      </td>

                      {/* Method */}
                      <td className="py-3.5 px-4 border-r border-slate-200 dark:border-[#202752]">
                        <div className="flex items-center gap-1.5">
                          {isFace ? (
                            <ScanFace className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          ) : log.method === 'FINGERPRINT' ? (
                            <Fingerprint className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                            {isFace ? 'Face ID' : log.method === 'FINGERPRINT' ? 'Vân tay FAP30' : log.method || 'Thủ công'}
                          </span>
                        </div>
                      </td>

                      {/* Device */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-[#202752]">
                        {log.device_id || 'FaceCam-01 (Cổng)'}
                      </td>

                      {/* AI Verification Score */}
                      <td className="py-3.5 px-4 font-mono border-r border-slate-200 dark:border-[#202752]">
                        <span
                          className={`font-bold ${score >= 0.9
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : score >= 0.75
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-red-600 dark:text-red-400'
                            }`}
                        >
                          {(score * 100).toFixed(1)}%
                        </span>
                      </td>

                      {/* Punctuality */}
                      <td className="py-3.5 px-4 border-r border-slate-200 dark:border-[#202752]">
                        {log.punctuality === 'LATE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                            Đi muộn
                          </span>
                        ) : log.punctuality === 'EARLY_LEAVE' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                            Về sớm
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                            Đúng giờ
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {log.status === 'VALID' ? 'HỢP LỆ' : log.status || 'HỢP LỆ'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
