import React from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ScanFace, 
  ArrowUpRight, 
  Plus, 
  CalendarRange, 
  ChevronRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

export const ManagerDashboard: React.FC = () => {
  const { employees, attendance, payroll } = useApp();
  const navigate = useNavigate();

  // Metric computations
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;
  
  // Today's punches
  const todayPunches = attendance.filter(a => a.timestamp.startsWith('2026-09-10'));
  const onTimeCount = todayPunches.filter(a => a.status === 'ON_TIME').length;
  const lateCount = todayPunches.filter(a => a.status === 'LATE').length;
  const onTimeRate = todayPunches.length > 0 ? ((onTimeCount / todayPunches.length) * 100).toFixed(1) : '94.2';

  // Weekly attendance bar chart data (matching Bento Grid Design HTML)
  const weeklyAttendanceData = [
    { day: 'T2', onTime: 28, late: 2 },
    { day: 'T3', onTime: 36, late: 1 },
    { day: 'T4', onTime: 32, late: 2 },
    { day: 'T5', onTime: 40, late: 0 },
    { day: 'T6', onTime: 24, late: 4 },
    { day: 'T7', onTime: 14, late: 0 },
    { day: 'CN', onTime: 0, late: 0 },
  ];

  // Department distribution (matching Bento Grid Design HTML)
  const deptData = [
    { name: 'Kỹ thuật', value: 42, color: '#3b82f6' },
    { name: 'Kinh doanh', value: 28, color: '#22c55e' },
    { name: 'Khác', value: 30, color: '#334155' },
  ];

  return (
    <div className="space-y-6">
      {/* Bento Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Tổng Quan Hệ Thống
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              Bento AIoT v2.5
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Bảng điều khiển theo dõi chấm công khuôn mặt & quản lý vận hành theo thời gian thực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/app/manager/employees')}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm nhân viên</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/app/manager/schedule')}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <CalendarRange className="w-4 h-4" />
            <span>Lịch làm việc</span>
          </button>
        </div>
      </div>

      {/* 4 Bento Metric Cards (Matching Design HTML exactly) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng nhân sự */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Tổng nhân sự
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-white font-mono">{totalEmployees > 0 ? totalEmployees : 156}</span>
            <span className="text-green-500 text-xs pb-1 font-medium">+2 tháng này</span>
          </div>
        </div>

        {/* Card 2: Có mặt hôm nay */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Có mặt hôm nay
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-white font-mono">{activeEmployees}</span>
            <span className="text-slate-500 text-xs pb-1 font-mono">/ {totalEmployees}</span>
          </div>
        </div>

        {/* Card 3: Tỷ lệ đúng giờ */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Tỷ lệ đúng giờ
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-white font-mono">{onTimeRate}%</span>
            <span className="text-orange-400 text-xs pb-1 font-medium">▼ 0.8%</span>
          </div>
        </div>

        {/* Card 4: Cảnh báo vắng */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Cảnh báo trễ / vắng
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-red-400 font-mono">
              {String(lateCount).padStart(2, '0')}
            </span>
            <span className="text-red-500 text-xs pb-1 font-medium">Cần xử lý</span>
          </div>
        </div>
      </div>

      {/* Middle Bento Section: Attendance Bar Chart & Department Donut */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Left: Weekly Attendance Chart (col-span-8) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-base">Biểu đồ chấm công tuần này</h3>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Đúng giờ
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Đi muộn
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px', color: '#fff' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="onTime" name="Đúng giờ" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="late" name="Đi muộn" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Department Structure (col-span-4) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <h3 className="font-bold text-white text-base mb-4">Cấu trúc phòng ban</h3>
          
          <div className="flex-1 flex items-center justify-center py-2">
            <div className="relative w-36 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deptData}
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={62}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {deptData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl font-bold font-mono text-white">3</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Teams</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Kỹ thuật AI
              </span>
              <span className="font-mono text-white font-medium">42%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Kinh doanh
              </span>
              <span className="font-mono text-white font-medium">28%</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-700"></span> Khác (HR, IT)
              </span>
              <span className="font-mono text-white font-medium">30%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bento Card: Real-time Attendance Logs (Matching Design HTML) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-white text-base">Nhật ký chấm công Face ID (Real-time)</h3>
          <button 
            type="button"
            onClick={() => navigate('/app/manager/attendance')}
            className="text-xs text-blue-500 hover:text-blue-400 font-semibold"
          >
            Xem tất cả &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-800">
                <th className="pb-3 font-medium">Nhân viên</th>
                <th className="pb-3 font-medium">Thời gian</th>
                <th className="pb-3 font-medium">Thiết bị</th>
                <th className="pb-3 font-medium text-center">Độ chính xác</th>
                <th className="pb-3 font-medium text-right">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-800/50">
              {attendance.slice(0, 5).map(att => {
                const emp = employees.find(e => e.employee_id === att.employee_id);
                const dateObj = new Date(att.timestamp);
                const initials = emp?.full_name
                  ? emp.full_name.split(' ').map(w => w[0]).slice(-2).join('')
                  : 'NV';

                return (
                  <tr key={att.attendance_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                        {emp?.avatar ? (
                          <img src={emp.avatar} alt={emp.full_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-white text-xs sm:text-sm">{emp?.full_name || att.employee_id}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{att.employee_id} • {emp?.department}</p>
                      </div>
                    </td>
                    <td className="py-3 font-mono text-xs text-slate-300">
                      {dateObj.toLocaleTimeString('vi-VN')}
                    </td>
                    <td className="py-3 text-xs text-slate-400 font-mono">
                      {att.device_id}
                    </td>
                    <td className="py-3 text-center">
                      <span className="bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-medium">
                        {(att.verification_score * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${
                          att.status === 'ON_TIME'
                            ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                            : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                        }`}
                      >
                        {att.status === 'ON_TIME' ? 'Đúng giờ' : 'Muộn ca'}
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
