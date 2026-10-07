import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatVNTime, formatVNDate } from '../../utils/dateUtils';
import {
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ScanFace,
  Fingerprint,
  Filter,
  ShieldCheck,
  Lock
} from 'lucide-react';

export const StaffAttendance: React.FC = () => {
  const { currentUser, attendance } = useApp();
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Staff's records only
  const myRecords = attendance.filter(
    a => a.employee_id === (currentUser?.employee_id || 'NV-001')
  );

  const filteredRecords = myRecords.filter(r => {
    if (methodFilter !== 'ALL' && r.method !== methodFilter) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Bento Top Banner with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
              Lịch sử Chấm công & Điểm danh
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-mono font-medium border border-purple-200 dark:border-purple-700/50">
              LOGS SINH TRẮC
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Ghi nhận tự động qua hệ thống Camera AIoT và máy quét vân tay tại các cửa ra vào.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/80 dark:bg-[#0f1224] border border-purple-200/80 dark:border-[#272d5a] text-purple-600 dark:text-purple-400 text-xs font-mono shadow-xs backdrop-blur-sm">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>CHỈ ĐỌC • DỮ LIỆU BẤT BIẾN</span>
        </div>
      </div>

      {/* Bento Filter Bar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Filter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Phương thức:</span>
          </div>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL" className="bg-white dark:bg-[#13162b]">Tất cả phương thức</option>
            <option value="FACE" className="bg-white dark:bg-[#13162b]">Khuôn mặt (Face ID)</option>
            <option value="FINGERPRINT" className="bg-white dark:bg-[#13162b]">Vân tay (Fingerprint)</option>
            <option value="MANUAL" className="bg-white dark:bg-[#13162b]">Thủ công (Manual)</option>
          </select>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 ml-2">
            <span>Loại điểm danh:</span>
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="ALL" className="bg-white dark:bg-[#13162b]">Vào ca & Tan ca</option>
            <option value="CHECK_IN" className="bg-white dark:bg-[#13162b]">Vào ca (Check-in)</option>
            <option value="CHECK_OUT" className="bg-white dark:bg-[#13162b]">Tan ca (Check-out)</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          Hiển thị: <strong className="text-slate-900 dark:text-white">{filteredRecords.length}</strong> bản ghi
        </span>
      </div>

      {/* Bento Attendance Table */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-200/80 dark:border-[#21264b] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Mã bản ghi</th>
                <th className="py-3.5 px-4 font-medium">Thời gian</th>
                <th className="py-3.5 px-4 font-medium">Loại sự kiện</th>
                <th className="py-3.5 px-4 font-medium">Phương thức</th>
                <th className="py-3.5 px-4 font-medium">Thiết bị điểm danh</th>
                <th className="py-3.5 px-4 font-medium">Độ tin cậy</th>
                <th className="py-3.5 px-4 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                    Không tìm thấy bản ghi chấm công nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => {
                  const timeFormatted = formatVNTime(record.timestamp);
                  const dateFormatted = formatVNDate(record.timestamp);

                  return (
                    <tr key={record.attendance_id} className="hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                        {record.attendance_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white font-mono">{timeFormatted}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{dateFormatted}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase font-mono ${record.type === 'CHECK_IN'
                            ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50'
                            : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700/50'
                            }`}
                        >
                          {record.type === 'CHECK_IN' ? 'VÀO CA' : 'TAN CA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {record.method === 'FACE' ? (
                            <>
                              <ScanFace className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Face ID</span>
                            </>
                          ) : record.method === 'FINGERPRINT' ? (
                            <>
                              <Fingerprint className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Vân tay</span>
                            </>
                          ) : (
                            <span>Thủ công</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {record.device_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        {(record.verification_score * 100).toFixed(1)}% Match
                      </td>
                      <td className="py-3.5 px-4">
                        {(() => {
                          const punctuality = record.punctuality || (record.status === 'VALID' ? 'ON_TIME' : record.status);
                          return (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${punctuality === 'ON_TIME'
                                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                  : punctuality === 'LATE'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                                    : punctuality === 'EARLY_LEAVE'
                                      ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                                      : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                                }`}
                            >
                              {punctuality === 'ON_TIME'
                                ? 'ĐÚNG GIỜ'
                                : punctuality === 'LATE'
                                  ? 'ĐI MUỘN'
                                  : punctuality === 'EARLY_LEAVE'
                                    ? 'VỀ SỚM'
                                    : 'VẮNG MẶT'}
                            </span>
                          );
                        })()}
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