import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
      {/* Bento Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Lịch sử Chấm công & Điểm danh
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              LOGS SINH TRẮC
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Ghi nhận tự động qua hệ thống Camera AIoT và máy quét vân tay tại các cửa ra vào.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 text-xs font-mono">
          <ShieldCheck className="w-4 h-4 text-green-500" />
          <span>CHỈ ĐỌC • DỮ LIỆU BẤT BIẾN</span>
        </div>
      </div>

      {/* Bento Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-4 h-4 text-blue-400" />
            <span>Phương thức:</span>
          </div>
          <select
            value={methodFilter}
            onChange={e => setMethodFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả phương thức</option>
            <option value="FACE">Khuôn mặt (Face ID)</option>
            <option value="FINGERPRINT">Vân tay (Fingerprint)</option>
            <option value="MANUAL">Thủ công (Manual)</option>
          </select>

          <div className="flex items-center gap-2 text-xs text-slate-400 ml-2">
            <span>Loại điểm danh:</span>
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Vào ca & Tan ca</option>
            <option value="CHECK_IN">Vào ca (Check-in)</option>
            <option value="CHECK_OUT">Tan ca (Check-out)</option>
          </select>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Hiển thị: <strong className="text-white">{filteredRecords.length}</strong> bản ghi
        </span>
      </div>

      {/* Bento Attendance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
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
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Không tìm thấy bản ghi chấm công nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredRecords.map(record => {
                  const dateObj = new Date(record.timestamp);
                  const timeFormatted = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateFormatted = dateObj.toLocaleDateString('vi-VN');

                  return (
                    <tr key={record.attendance_id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {record.attendance_id}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white font-mono">{timeFormatted}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{dateFormatted}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg font-bold text-[10px] uppercase font-mono ${
                            record.type === 'CHECK_IN'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          }`}
                        >
                          {record.type === 'CHECK_IN' ? 'VÀO CA' : 'TAN CA'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {record.method === 'FACE' ? (
                            <>
                              <ScanFace className="w-3.5 h-3.5 text-blue-400" />
                              <span>Face ID</span>
                            </>
                          ) : record.method === 'FINGERPRINT' ? (
                            <>
                              <Fingerprint className="w-3.5 h-3.5 text-green-400" />
                              <span>Vân tay</span>
                            </>
                          ) : (
                            <span>Thủ công</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {record.device_id}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-green-500 font-bold">
                        {(record.verification_score * 100).toFixed(1)}% Match
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                            record.status === 'ON_TIME'
                              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                              : record.status === 'LATE'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {record.status === 'ON_TIME' ? 'ĐÚNG GIỜ' : record.status === 'LATE' ? 'ĐI MUỘN' : 'VẮNG MẶT'}
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
