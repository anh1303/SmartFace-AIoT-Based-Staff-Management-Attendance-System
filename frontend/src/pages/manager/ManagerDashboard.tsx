import React from 'react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { formatVNTime, getTodayVNString, formatVNDateISO } from '../../utils/dateUtils';
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
import {
  PageHeaderBanner,
  TableContainer,
  TableHead,
  TableHeadRow,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmpty
} from '../../components/common';

export const ManagerDashboard: React.FC = () => {
  const { employees, attendance } = useApp();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  // Metric computations
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === 'ACTIVE').length;

  // Latest date punches or today
  const latestDateStr = attendance.length > 0
    ? formatVNDateISO(attendance[0].timestamp)
    : getTodayVNString();

  const getPunctuality = (a: { punctuality?: string; status: string }) =>
    a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status);

  const todayPunches = attendance.filter(a => formatVNDateISO(a.timestamp) === latestDateStr);
  const onTimeCount = todayPunches.filter(a => getPunctuality(a) === 'ON_TIME').length;
  const lateCount = todayPunches.filter(a => getPunctuality(a) === 'LATE' || getPunctuality(a) === 'EARLY_LEAVE').length;
  const onTimeRate = todayPunches.length > 0
    ? ((onTimeCount / todayPunches.length) * 100).toFixed(1)
    : (attendance.length > 0 ? ((attendance.filter(a => getPunctuality(a) === 'ON_TIME').length / attendance.length) * 100).toFixed(1) : '100.0');

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
      if (getPunctuality(a) === 'ON_TIME') dayCounts[dayLabel].onTime += 1;
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
  const deptColors = ['#8b5cf6', '#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];
  const deptCounts: Record<string, number> = {};
  employees.forEach(e => {
    const d = e.department || 'Chưa phân chức vụ';
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
      {/* Bento Header Bar with Continuous Animated Shifting Gradient & Floating Blobs */}
      <PageHeaderBanner
        title="Tổng Quan Hệ Thống"
        actions={
          <button
            onClick={() => navigate('/app/manager/employees')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs shadow-purple-500/25 transition-all cursor-pointer"
          >
            Quản lý nhân sự
          </button>
        }
      />

      {/* 4 Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tổng nhân sự */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-purple-300 dark:hover:border-[#2f3668] transition-all shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Tổng nhân sự
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{totalEmployees}</span>
            <span className="text-emerald-600 dark:text-emerald-400 text-xs pb-1 font-medium">{activeEmployees} Đang hoạt động</span>
          </div>
        </div>

        {/* Card 2: Có mặt hôm nay */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-purple-300 dark:hover:border-[#2f3668] transition-all shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Lượt Check in/out ({latestDateStr})
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{todayPunches.length}</span>
            <span className="text-slate-400 dark:text-slate-500 text-xs pb-1 font-mono">/ {attendance.length} tổng</span>
          </div>
        </div>

        {/* Card 3: Tỷ lệ đúng giờ */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-purple-300 dark:hover:border-[#2f3668] transition-all shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Tỷ lệ đúng giờ
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-slate-900 dark:text-white font-mono">{onTimeRate}%</span>
            <span className="text-purple-600 dark:text-purple-400 text-xs pb-1 font-medium">{onTimeCount} đúng giờ</span>
          </div>
        </div>

        {/* Card 4: Cảnh báo vắng */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-4 sm:p-5 flex flex-col justify-between hover:border-purple-300 dark:hover:border-[#2f3668] transition-all shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Cảnh báo trễ / sớm
          </span>
          <div className="flex items-end justify-between mt-3">
            <span className="text-3xl font-bold text-amber-500 dark:text-amber-400 font-mono">
              {String(lateCount).padStart(2, '0')}
            </span>
            <span className="text-amber-600 dark:text-amber-500 text-xs pb-1 font-medium">Lượt vi phạm</span>
          </div>
        </div>
      </div>

      {/* Middle Bento Section: Attendance Bar Chart & Department Donut */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Left: Weekly Attendance Chart (col-span-8) */}
        <div className="lg:col-span-8 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 flex flex-col justify-between shadow-xs transition-colors">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Biểu đồ chấm công chuyên cần</h3>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-purple-600 dark:bg-purple-500"></span> Đúng giờ
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span> Đi muộn / về sớm
              </span>
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendanceData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#0f1224' : '#ffffff',
                    borderColor: isDark ? '#21264b' : '#e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: isDark ? '#ffffff' : '#0f172a',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  labelStyle={{ color: isDark ? '#94a3b8' : '#64748b' }}
                />
                <Bar dataKey="onTime" name="Đúng giờ" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="late" name="Đi muộn" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right: Department Structure (col-span-4) */}
        <div className="lg:col-span-4 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl p-6 flex flex-col justify-between shadow-xs transition-colors">
          <h3 className="font-bold text-slate-900 dark:text-white text-base mb-4">Cấu trúc chức vụ</h3>

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
                    contentStyle={{
                      backgroundColor: isDark ? '#0f1224' : '#ffffff',
                      borderColor: isDark ? '#21264b' : '#e2e8f0',
                      borderRadius: '12px',
                      fontSize: '12px',
                      color: isDark ? '#ffffff' : '#0f172a'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">{deptData.length}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Chức vụ</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4 pt-4 border-t border-slate-100 dark:border-[#1d2243]">
            {deptData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }}></span> {d.name}
                </span>
                <span className="font-mono text-slate-900 dark:text-white font-medium">{d.value} NV ({d.percentage}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Bento Card: Real-time Attendance Logs */}
      <div className="space-y-3">
        <div className="p-1 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Nhật ký chấm công Face ID (Real-time)</h3>
          <button
            type="button"
            onClick={() => navigate('/app/manager/attendance')}
            className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold cursor-pointer"
          >
            Xem tất cả &rarr;
          </button>
        </div>

        <TableContainer minWidth="700px">
          <TableHead>
            <TableHeadRow>
              <TableHeadCell width="220px" align="left">Nhân viên</TableHeadCell>
              <TableHeadCell width="110px" align="center">Thời gian</TableHeadCell>
              <TableHeadCell width="140px">Thiết bị</TableHeadCell>
              <TableHeadCell width="110px" align="center">Độ chính xác</TableHeadCell>
              <TableHeadCell width="120px" align="center" isLast>Trạng thái</TableHeadCell>
            </TableHeadRow>
          </TableHead>
          <TableBody>
            {attendance.length === 0 ? (
              <TableEmpty colSpan={5} message="Chưa có dữ liệu chấm công." />
            ) : (
              attendance.slice(0, 5).map(att => {
                const emp = employees.find(e => e.employee_id === att.employee_id);
                const empName = emp?.full_name || att.employee_id;
                const initials = emp?.full_name
                  ? emp.full_name.split(' ').map(w => w[0]).slice(-2).join('')
                  : 'NV';

                return (
                  <TableRow key={att.attendance_id}>
                    <TableCell align="left" className="max-w-[220px]">
                      <div className="flex items-center gap-3 min-w-0 text-left" title={empName}>
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-[#181c38] border border-purple-200 dark:border-[#272d5a] flex items-center justify-center text-[10px] font-bold text-purple-700 dark:text-purple-300 shrink-0">
                          {emp?.avatar ? (
                            <img src={emp.avatar} alt={emp.full_name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-medium text-slate-900 dark:text-white text-xs sm:text-sm truncate text-left" title={empName}>{empName}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate text-left" title={`${att.employee_id} • ${emp?.department}`}>{att.employee_id} • {emp?.department}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell align="center" className="font-mono text-xs text-slate-600 dark:text-slate-300 truncate" title={formatVNTime(att.timestamp)}>
                      {formatVNTime(att.timestamp)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[140px]" title={att.device_id}>
                      {att.device_id}
                    </TableCell>
                    <TableCell align="center">
                      <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium">
                        {att.verification_score !== null && att.verification_score !== undefined
                          ? `${(att.verification_score * 100).toFixed(1)}%`
                          : '--'}
                      </span>
                    </TableCell>
                    <TableCell isLast align="center">
                      {(() => {
                        const punc = getPunctuality(att);
                        return (
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono ${punc === 'ON_TIME'
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                              : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20'
                              }`}
                          >
                            {punc === 'ON_TIME' ? 'Đúng giờ' : punc === 'EARLY_LEAVE' ? 'Về sớm' : 'Muộn ca'}
                          </span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </TableContainer>
      </div>
    </div>
  );
};
