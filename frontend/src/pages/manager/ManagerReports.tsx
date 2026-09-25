import React from 'react';
import { useApp } from '../../context/AppContext';
import { getTodayVNString } from '../../utils/dateUtils';
import {
  BarChart3,
  Download,
  Calendar,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckCircle2,
  ScanFace,
  FileSpreadsheet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const ManagerReports: React.FC = () => {
  const { employees, attendance, payroll, showToast } = useApp();

  // Dynamic Payroll Trend Data by Period
  const periodsMap: Record<string, number> = {};
  payroll.forEach(p => {
    const period = p.period || '2026-09';
    const amount = Number(p.net_salary || 0);
    periodsMap[period] = (periodsMap[period] || 0) + amount;
  });

  const sortedPeriods = Object.keys(periodsMap).sort();
  const payrollTrendData = sortedPeriods.map(period => ({
    period: `T${period.slice(5)}/${period.slice(2, 4)}`,
    cost: Number((periodsMap[period] / 1000000).toFixed(1)),
  }));

  // Dynamic Method Breakdown from Attendance Logs
  const totalLogs = attendance.length;
  const faceLogs = attendance.filter(a => a.method === 'FACE').length;
  const fpLogs = attendance.filter(a => a.method === 'FINGERPRINT').length;
  const manualLogs = attendance.filter(a => a.method === 'MANUAL').length;

  const methodBreakdown = [
    {
      name: 'Khuôn mặt (Face ID 512D)',
      value: totalLogs > 0 ? Math.round((faceLogs / totalLogs) * 100) : 0,
      count: faceLogs,
      color: '#3b82f6'
    },
    {
      name: 'Vân tay (Fingerprint)',
      value: totalLogs > 0 ? Math.round((fpLogs / totalLogs) * 100) : 0,
      count: fpLogs,
      color: '#22c55e'
    },
    {
      name: 'Thủ công (Manual Kiosk)',
      value: totalLogs > 0 ? Math.round((manualLogs / totalLogs) * 100) : 0,
      count: manualLogs,
      color: '#f59e0b'
    },
  ];

  // Dynamic 4-Week Punctuality Trend (sliding window of 4 recent weeks)
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getISOWeekNumber = (d: Date) => {
    const target = new Date(d.valueOf());
    const dayNr = (d.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
    }
    return 1 + Math.round((firstThursday - target.valueOf()) / 604800000);
  };

  const currentMonday = getMonday(new Date());

  const punctualityData = [3, 2, 1, 0].map(weeksAgo => {
    const weekStart = new Date(currentMonday);
    weekStart.setDate(currentMonday.getDate() - weeksAgo * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekNum = getISOWeekNumber(weekStart);
    const weekAttendance = attendance.filter(a => {
      const t = new Date(a.timestamp).getTime();
      return t >= weekStart.getTime() && t <= weekEnd.getTime();
    });

    const total = weekAttendance.length;
    const onTime = weekAttendance.filter(a => (a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status)) === 'ON_TIME').length;
    const rate = total > 0 ? Number(((onTime / total) * 100).toFixed(1)) : 0;

    return {
      week: `Tuần ${weekNum}`,
      rate,
      count: total,
      onTimeCount: onTime,
    };
  });

  const hasPunctualityData = attendance.length > 0 && punctualityData.some(p => p.count > 0);

  // Dynamic Leaderboard from attendance logs
  const empStats = employees.map(emp => {
    const empAtt = attendance.filter(a => a.employee_id === emp.employee_id);
    const totalPunches = empAtt.length;
    const onTimePunches = empAtt.filter(a => (a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status)) === 'ON_TIME').length;
    const rateNum = totalPunches > 0 ? (onTimePunches / totalPunches) * 100 : 0;

    let badge = 'XUẤT SẮC';
    if (totalPunches === 0) badge = 'CHƯA CÓ LƯỢT';
    else if (rateNum < 90) badge = 'CẦN LƯU Ý';
    else if (rateNum < 98) badge = 'TỐT';

    return {
      name: emp.full_name,
      dept: emp.department || 'Chung',
      rate: totalPunches > 0 ? `${rateNum.toFixed(1)}%` : '--',
      rateNum,
      onTime: `${onTimePunches}/${totalPunches} lượt`,
      badge,
    };
  }).sort((a, b) => b.rateNum - a.rateNum);

  const handleExportCSV = () => {
    const headers = ['Mã NV', 'Họ và Tên', 'Chức vụ', 'Vị trí', 'Email', 'Trạng Thái', 'Lương Cơ Bản (VNĐ)', 'Face ID', 'Vân Tay'];

    const rows = employees.map(emp => [
      emp.employee_id,
      `"${emp.full_name}"`,
      `"${emp.department}"`,
      `"${emp.position}"`,
      emp.email,
      emp.status,
      emp.hourly_rate || 0,
      emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA',
      emp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_cham_cong_AIoT_${getTodayVNString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast('Đã xuất file báo cáo CSV thành công!', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Bento Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
            Báo Cáo & Thống Kê Chuyên Cần
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tổng hợp xu hướng đi làm, phương thức sinh trắc và phân tích chi phí nhân sự.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
        >
          <Download className="w-4 h-4" />
          <span>Xuất báo cáo CSV</span>
        </button>
      </div>

      {/* Bento Charts Grid */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Payroll Expense Trend */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Chi phí quỹ lương theo kỳ (Triệu VNĐ)
              </h2>
              <p className="text-xs text-slate-400">Tổng ngân sách chi trả thực tế các kỳ</p>
            </div>
            <span className="text-xs font-mono text-blue-400 font-bold">{payrollTrendData.length} kỳ lương</span>
          </div>

          {payrollTrendData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={payrollTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="cost" name="Quỹ lương (Triệu ₫)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <FileSpreadsheet className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
              <span>Chưa có dữ liệu</span>
            </div>
          )}
        </div>

        {/* Punctuality Rate Area Chart */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Tỷ lệ đi làm đúng giờ theo tuần (%)
              </h2>
              <p className="text-xs text-slate-400">Đo lường mức độ tuân thủ nội quy (4 tuần gần nhất)</p>
            </div>
            <span className="text-xs font-mono text-green-500 font-bold">Thời gian thực</span>
          </div>

          {hasPunctualityData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={punctualityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="punctualityColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(val: unknown, _name: unknown, item: { payload?: { count?: number } }) => [
                      (item?.payload?.count ?? 0) > 0 ? `${val}%` : 'Chưa có dữ liệu',
                      'Tỷ lệ đúng giờ'
                    ]}
                  />
                  <Area type="monotone" dataKey="rate" name="Tỷ lệ đúng giờ" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#punctualityColor)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <BarChart3 className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
              <span>Chưa có dữ liệu</span>
            </div>
          )}
        </div>
      </div>

      {/* Bento Biometrics Distribution & Punctuality Leaderboard */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Method breakdown */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <h2 className="text-base font-bold text-white font-heading">
            Cơ cấu phương thức chấm công
          </h2>
          <p className="text-xs text-slate-400">Tỷ lệ sử dụng công nghệ Face ID so với các phương thức khác</p>

          {totalLogs > 0 ? (
            <>
              <div className="h-44 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {methodBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 text-xs">
                {methodBreakdown.map(m => (
                  <div key={m.name} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-slate-300">{m.name}</span>
                    </div>
                    <span className="font-mono font-bold text-white">{m.value}% ({m.count} lượt)</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 w-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <ScanFace className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
              <span>Chưa có dữ liệu</span>
            </div>
          )}
        </div>

        {/* Attendance Leaderboard */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-heading">
              Bảng Xếp Hạng Chuyên Cần Nhân Sự
            </h2>
            <span className="text-xs text-slate-400">Đánh giá chuẩn KPI CSDL</span>
          </div>

          <div className="space-y-3">
            {empStats.length > 0 ? (
              empStats.map((item, idx) => (
                <div
                  key={item.name}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${idx === 0
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : idx === 1
                          ? 'bg-slate-700/20 text-slate-200 border border-slate-700/40'
                          : 'bg-slate-900 text-slate-400 border border-slate-800'
                        }`}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">{item.name}</p>
                      <p className="text-[10px] text-slate-400">{item.dept} • {item.onTime}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-blue-400">{item.rate}</span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${item.badge === 'XUẤT SẮC'
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                        : item.badge === 'TỐT'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : item.badge === 'CẦN LƯU Ý'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                    >
                      {item.badge}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-500">Chưa có dữ liệu nhân sự</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};