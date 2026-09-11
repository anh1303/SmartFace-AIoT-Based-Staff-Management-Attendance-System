import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Eye, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ScanFace, 
  Fingerprint, 
  Search, 
  Filter, 
  Radio, 
  ShieldCheck, 
  Server, 
  Activity 
} from 'lucide-react';

export const ManagerAttendanceMonitor: React.FC = () => {
  const { attendance, employees } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

  const filteredLogs = attendance.filter(log => {
    const emp = employees.find(e => e.employee_id === log.employee_id);
    const empName = emp?.full_name || '';
    const matchSearch =
      empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.device_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || log.status === statusFilter;
    const matchMethod = methodFilter === 'ALL' || log.method === methodFilter;

    return matchSearch && matchStatus && matchMethod;
  });

  const devices = [
    { name: 'FaceCam-01', location: 'Cổng Chính Tòa A', status: 'ONLINE', latency: '18ms', fps: '30 FPS', temp: '42°C' },
    { name: 'CAM-04 (Turnstile)', location: 'Cổng Phụ Khu B', status: 'ONLINE', latency: '24ms', fps: '30 FPS', temp: '44°C' },
    { name: 'FaceCam-02', location: 'Cửa Lab Kỹ Thuật AI', status: 'ONLINE', latency: '19ms', fps: '30 FPS', temp: '41°C' },
    { name: 'FP-Gate-02', location: 'Máy Vân Tay Dự Phòng', status: 'ONLINE', latency: '32ms', fps: 'N/A', temp: '38°C' },
  ];

  return (
    <div className="space-y-6">
      {/* Bento Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Giám Sát Chấm Công Toàn Doanh Nghiệp
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-mono font-medium border border-green-500/20 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> REAL-TIME STREAM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dữ liệu điểm danh trực tiếp từ các thiết bị AI Edge Camera và cổng xoay an ninh.
          </p>
        </div>

        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-blue-400 text-xs font-mono">
          <Server className="w-4 h-4 text-blue-400" />
          <span>4/4 EDGE AI CLUSTERS ONLINE</span>
        </div>
      </div>

      {/* Edge Devices Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {devices.map(dev => (
          <div key={dev.name} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <ScanFace className="w-4 h-4 text-blue-400" />
                  {dev.name}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{dev.location}</p>
              </div>
              <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                {dev.status}
              </span>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-800 flex justify-between text-[10px] font-mono text-slate-400">
              <span>Độ trễ: <strong className="text-blue-400">{dev.latency}</strong></span>
              <span>Nhiệt độ: <strong className="text-green-500">{dev.temp}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Bento Filters and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row items-center justify-between gap-4">
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo nhân viên, mã số, thiết bị..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'ON_TIME', 'LATE', 'EARLY_LEAVE'].map(statusKey => {
            const label = statusKey === 'ALL' ? 'Tất cả' : statusKey === 'ON_TIME' ? 'Đúng giờ' : statusKey === 'LATE' ? 'Đi muộn' : 'Về sớm';
            return (
              <button
                key={statusKey}
                type="button"
                onClick={() => setStatusFilter(statusKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  statusFilter === statusKey
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bento Master Attendance Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-500 uppercase font-mono text-[11px]">
              <tr>
                <th className="py-3.5 px-4 font-medium">Nhân sự</th>
                <th className="py-3.5 px-4 font-medium">Thời gian</th>
                <th className="py-3.5 px-4 font-medium">Sự kiện</th>
                <th className="py-3.5 px-4 font-medium">Phương thức</th>
                <th className="py-3.5 px-4 font-medium">Thiết bị điểm danh</th>
                <th className="py-3.5 px-4 font-medium">Khớp Face ID</th>
                <th className="py-3.5 px-4 font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredLogs.map(log => {
                const emp = employees.find(e => e.employee_id === log.employee_id);
                const dateObj = new Date(log.timestamp);

                return (
                  <tr key={log.attendance_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                          alt={emp?.full_name}
                          className="w-8 h-8 rounded-full object-cover border border-slate-700"
                        />
                        <div>
                          <p className="font-semibold text-white">{emp?.full_name || log.employee_id}</p>
                          <p className="text-[10px] text-slate-400">{emp?.department} • {log.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-white">{dateObj.toLocaleTimeString('vi-VN')}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{dateObj.toLocaleDateString('vi-VN')}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded-lg font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {log.type === 'CHECK_IN' ? 'VÀO CA' : 'TAN CA'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        {log.method === 'FACE' ? (
                          <>
                            <ScanFace className="w-3.5 h-3.5 text-blue-400" />
                            <span>Face ID</span>
                          </>
                        ) : log.method === 'FINGERPRINT' ? (
                          <>
                            <Fingerprint className="w-3.5 h-3.5 text-green-400" />
                            <span>Vân tay</span>
                          </>
                        ) : (
                          <span>Thủ công</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400">
                      {log.device_id}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-green-500 font-bold">
                      {(log.verification_score * 100).toFixed(1)}%
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                          log.status === 'ON_TIME'
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {log.status === 'ON_TIME' ? 'ĐÚNG GIỜ' : 'ĐI MUỘN'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
