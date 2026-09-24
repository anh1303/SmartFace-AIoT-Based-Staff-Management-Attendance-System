import React from 'react';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { formatVNTime } from '../../utils/dateUtils';
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

  // Latest date punches or today
  const latestDateStr = attendance.length > 0
    ? attendance[0].timestamp.slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const todayPunches = attendance.filter(a => a.timestamp.startsWith(latestDateStr));
  const onTimeCount = todayPunches.filter(a => a.status === 'ON_TIME').length;
  const lateCount = todayPunches.filter(a => a.status === 'LATE' || a.status === 'EARLY_LEAVE').length;
  const onTimeRate = todayPunches.length > 0
    ? ((onTimeCount / todayPunches.length) * 100).toFixed(1)
    : (attendance.length > 0 ? ((attendance.filter(a => a.status === 'ON_TIME').length / attendance.length) * 100).toFixed(1) : '100.0');

  // Dynamic Weekly attendance bar chart data from attendance records
  const dayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayCounts: Record<string, { onTime: number; late: number }> = {
    T2: { onTime: 0, late: 0 },
    T3: { onTime: 0, late: 0 },
    T4: { onTime: 0, late: 0 },
    T5: { onTime: 0, late: 0 },
    T6: { onTime: 0, late: 0 },
    T7: { onTime: 0, late: 0 },
    CN: { onTime: 0, late: 0 },
  };

  attendance.forEach(a => {
    const d = new Date(a.timestamp);
    const dayLabel = dayLabels[d.getDay()];
    if (dayCounts[dayLabel]) {
      if (a.status === 'ON_TIME') dayCounts[dayLabel].onTime += 1;
      else dayCounts[dayLabel].late += 1;
    }
  });

  const weeklyAttendanceData = [
    { day: 'T2', onTime: dayCounts.T2.onTime, late: dayCounts.T2.late },
    { day: 'T3', onTime: dayCounts.T3.onTime, late: dayCounts.T3.late },
    { day: 'T4', onTime: dayCounts.T4.onTime, late: dayCounts.T4.late },
    { day: 'T5', onTime: dayCounts.T5.onTime, late: dayCounts.T5.late },
    { day: 'T6', onTime: dayCounts.T6.onTime, late: dayCounts.T6.late },
    { day: 'T7', onTime: dayCounts.T7.onTime, late: dayCounts.T7.late },
    { day: 'CN', onTime: dayCounts.CN.onTime, late: dayCounts.CN.late },
  ];

  // Dynamic Department distribution from employees
  const deptColors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#06b6d4', '#64748b'];
  const deptCounts: Record<string, number> = {};
  employees.forEach(e => {
    const d = e.department || 'Chưa phân ban';
    deptCounts[d] = (deptCounts[d] || 0) + 1;
  });

  const deptData = Object.entries(deptCounts).map(([name, count], idx) => ({
    name,
    value: count,
    percentage: totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0,
    color: deptColors[idx % deptColors.length],
  }));

  return (
    <div className="space-y-6">
      {/* Bento Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Tổng Quan Hệ Thống
            </h1>
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
            <span className="text-3xl font-bold text-white font-mono">{totalEmployees}</span>
            <span className="text-green-500 text-xs pb-1 font-medium">{activeEmployees} Đang hoạt động</span>
          </div>
        </div>

        {/* Card 2: Có mặt hôm nay */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Lượt quẹt ({latestDateStr})
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-white font-mono">{todayPunches.length}</span>
            <span className="text-slate-500 text-xs pb-1 font-mono">/ {attendance.length} tổng</span>
          </div>
        </div>

        {/* Card 3: Tỷ lệ đúng giờ */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Tỷ lệ đúng giờ
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-white font-mono">{onTimeRate}%</span>
            <span className="text-blue-400 text-xs pb-1 font-medium">{onTimeCount} đúng giờ</span>
          </div>
        </div>

        {/* Card 4: Cảnh báo vắng */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Cảnh báo trễ / sớm
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-orange-400 font-mono">
              {String(lateCount).padStart(2, '0')}
            </span>
            <span className="text-orange-500 text-xs pb-1 font-medium">Lượt vi phạm</span>
          </div>
        </div>
      </div>

      {/* Middle Bento Section: Attendance Bar Chart & Department Donut */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Left: Weekly Attendance Chart (col-span-8) */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-white text-base">Biểu đồ chấm công chuyên cần</h3>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Đúng giờ
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Đi muộn / về sớm
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
                <span className="text-xl font-bold font-mono text-white">{deptData.length}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Phòng ban</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-slate-800">
            {deptData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300 truncate max-w-[140px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span> {d.name}
                </span>
                <span className="font-mono text-white font-medium">{d.value} NV ({d.percentage}%)</span>
              </div>
            ))}
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
                      {formatVNTime(att.timestamp)}
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
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${att.status === 'ON_TIME'
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