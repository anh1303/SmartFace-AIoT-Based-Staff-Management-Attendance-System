import React, { useState } from 'react';
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
  FileSpreadsheet,
  Users,
  Check,
  Sparkles
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
import { Modal } from '../../components/common/Modal';

export const ManagerReports: React.FC = () => {
  const { employees, attendance, payroll, selectedPeriod, showToast } = useApp();

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportType, setExportType] = useState<'attendance' | 'payroll' | 'employees'>('attendance');

  // Dynamic Payroll Trend Data by Period
  const periodsMap: Record<string, number> = {};
  payroll.forEach(p => {
    const period = p.period || p.payroll_period || '2026-09';
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
      color: '#10b981'
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
    const latePunches = totalPunches - onTimePunches;
    const rateNum = totalPunches > 0 ? (onTimePunches / totalPunches) * 100 : 0;

    let badge = 'XUẤT SẮC';
    if (totalPunches === 0) badge = 'CHƯA CÓ LƯỢT';
    else if (rateNum < 90) badge = 'CẦN LƯU Ý';
    else if (rateNum < 98) badge = 'TỐT';

    return {
      id: emp.employee_id,
      name: emp.full_name,
      dept: emp.department || 'Chung',
      position: emp.position || 'Nhân viên',
      totalPunches,
      onTimePunches,
      latePunches,
      rate: totalPunches > 0 ? `${rateNum.toFixed(1)}%` : '--',
      rateNum,
      onTime: `${onTimePunches}/${totalPunches} lượt`,
      badge,
    };
  }).sort((a, b) => b.rateNum - a.rateNum);

  // Handle Export based on selected report type
  const handleExecuteExport = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let fileName = '';

    if (exportType === 'attendance') {
      // Option 1: Attendance Summary Report
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Chức Vụ',
        'Tổng Số Lượt Điểm Danh',
        'Số Lượt Đúng Giờ',
        'Số Lượt Đi Muộn / Về Sớm',
        'Tỷ Lệ Đúng Giờ (%)',
        'Xếp Loại Chuyên Cần'
      ];

      rows = empStats.map(stat => [
        stat.id,
        `"${stat.name}"`,
        `"${stat.dept}"`,
        `"${stat.position}"`,
        stat.totalPunches,
        stat.onTimePunches,
        stat.latePunches,
        stat.totalPunches > 0 ? `${stat.rateNum.toFixed(1)}%` : '0%',
        `"${stat.badge}"`
      ]);

      fileName = `Bao_cao_tong_hop_chuyen_can_${getTodayVNString()}.csv`;
    } else if (exportType === 'payroll') {
      // Option 2: Payroll Expense Report
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Kỳ Lương',
        'Lương Theo Giờ (VNĐ)',
        'Tổng Giờ Làm (h)',
        'Số Giờ Tăng Ca (h)',
        'Số Giờ Đi Trễ / Về Sớm (h)',
        'Phụ Cấp (VNĐ)',
        'Thực Lĩnh Net (VNĐ)',
        'Trạng Thái'
      ];

      const activeRecords = payroll.length > 0 ? payroll : [];
      rows = activeRecords.map(r => {
        const emp = employees.find(e => e.employee_id === r.employee_id);
        const name = emp?.full_name || r.employee_name || r.employee_id;
        const statusStr = r.status === 'FINALIZED' ? 'Đã Chốt' : 'Đang Soạn Thảo';
        return [
          r.employee_id,
          `"${name}"`,
          r.period || r.payroll_period || selectedPeriod,
          r.hourly_rate || 0,
          r.total_working_hours || 0,
          r.total_overtime ?? 0,
          r.total_late_early ?? 0,
          r.allowance || 0,
          r.net_salary || 0,
          `"${statusStr}"`
        ];
      });

      fileName = `Bao_cao_chi_phi_luong_${selectedPeriod || getTodayVNString()}.csv`;
    } else {
      // Option 3: Employee Profiles & Biometrics
      headers = [
        'Mã NV',
        'Họ và Tên',
        'Phòng Ban',
        'Chức Vụ',
        'Email',
        'Trạng Thái',
        'Lương Theo Giờ (VNĐ)',
        'Face ID 512D',
        'Vân Tay'
      ];

      rows = employees.map(emp => [
        emp.employee_id,
        `"${emp.full_name}"`,
        `"${emp.department}"`,
        `"${emp.position}"`,
        emp.email,
        emp.status === 'ACTIVE' ? 'Đang Làm Việc' : 'Tạm Dừng',
        emp.hourly_rate || 0,
        emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ',
        emp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA ĐĂNG KÝ'
      ]);

      fileName = `Danh_sach_nhan_su_va_sinh_trac_${getTodayVNString()}.csv`;
    }

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportModalOpen(false);
    showToast(`Đã xuất báo cáo CSV: ${fileName}`, 'success');
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
            Tổng hợp xu hướng đi làm, phương thức sinh trắc và phân tích chi phí nhân sự toàn hệ thống.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExportModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-95"
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
            <span className="text-xs font-mono text-emerald-400 font-bold">Thời gian thực</span>
          </div>

          {hasPunctualityData ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={punctualityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="punctualityColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                  <Area type="monotone" dataKey="rate" name="Tỷ lệ đúng giờ" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#punctualityColor)" />
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
        {/* Method breakdown with Larger Outer Radius (85) and Percentage Legend */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Cơ cấu phương thức chấm công
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Tỷ lệ nhận diện khuôn mặt Face ID so với các phương thức khác
            </p>
          </div>

          {totalLogs > 0 ? (
            <>
              {/* Outer Radius 85, Inner Radius 55 */}
              <div className="h-56 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {methodBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                      formatter={(val: any, name: any, item: any) => [
                        `${val}% (${item?.payload?.count || 0} lượt)`,
                        item?.payload?.name || name
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Clear Legend with Percentage and Exact Punch Count */}
              <div className="space-y-2 text-xs pt-1">
                {methodBreakdown.map(m => (
                  <div key={m.name} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: m.color }} />
                      <span className="text-slate-300 font-medium">{m.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-sm">{m.value}%</span>
                      <span className="text-slate-400 text-[11px] font-mono">({m.count} lượt)</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 w-full flex flex-col items-center justify-center text-slate-500 text-xs">
              <ScanFace className="w-8 h-8 mb-2 stroke-1 opacity-50 text-slate-400" />
              <span>Chưa có dữ liệu chấm công</span>
            </div>
          )}
        </div>

        {/* Attendance Leaderboard */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Bảng Xếp Hạng Chuyên Cần Nhân Sự
              </h2>
              <p className="text-xs text-slate-400">Đánh giá tỷ lệ đúng giờ và chấp hành ca trực</p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Đánh giá KPI CSDL</span>
          </div>

          <div className="space-y-3">
            {empStats.length > 0 ? (
              empStats.map((item, idx) => (
                <div
                  key={item.id}
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
                      className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full ${item.badge === 'XUẤT SẮC'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
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

      {/* CSV Export Option Modal */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Xuất báo cáo hệ thống (CSV / Excel)"
        subtitle="Chọn loại báo cáo bạn muốn tải xuống với đầy đủ dữ liệu cập nhật"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="space-y-2.5">
            {/* Option 1: Attendance */}
            <div
              onClick={() => setExportType('attendance')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                exportType === 'attendance'
                  ? 'bg-blue-600/10 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className={`p-2 rounded-xl mt-0.5 ${exportType === 'attendance' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                <Award className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">1. Báo cáo Tổng hợp Chuyên cần (Attendance Summary)</p>
                  {exportType === 'attendance' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Xuất dữ liệu: Mã NV, Họ tên, Phòng ban, Tổng lượt điểm danh, Số lượt đúng giờ, Đi muộn/Về sớm, Tỷ lệ đúng giờ (%), Xếp loại thi đua.
                </p>
              </div>
            </div>

            {/* Option 2: Payroll */}
            <div
              onClick={() => setExportType('payroll')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                exportType === 'payroll'
                  ? 'bg-blue-600/10 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className={`p-2 rounded-xl mt-0.5 ${exportType === 'payroll' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">2. Báo cáo Chi phí Lương (Payroll Report)</p>
                  {exportType === 'payroll' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Xuất dữ liệu: Mã NV, Họ tên, Kỳ lương, Lương theo giờ, Giờ làm việc, Giờ tăng ca, Giờ trễ/sớm, Phụ cấp, Lương thực lĩnh Net, Trạng thái chốt sổ.
                </p>
              </div>
            </div>

            {/* Option 3: Employees & Biometrics */}
            <div
              onClick={() => setExportType('employees')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                exportType === 'employees'
                  ? 'bg-blue-600/10 border-blue-500 text-white shadow-sm'
                  : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              <div className={`p-2 rounded-xl mt-0.5 ${exportType === 'employees' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-400'}`}>
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">3. Hồ sơ & Đăng ký Sinh trắc (Employee Biometrics)</p>
                  {exportType === 'employees' && <Check className="w-4 h-4 text-blue-400" />}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Xuất danh sách: Mã NV, Họ tên, Phòng ban, Chức vụ, Email, Trạng thái, Lương cơ bản, Trạng thái Face ID 512D, Vân tay.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsExportModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleExecuteExport}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải file CSV ngay</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};