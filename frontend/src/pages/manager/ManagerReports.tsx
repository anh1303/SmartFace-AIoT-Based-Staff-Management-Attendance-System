import React from 'react';
import { useApp } from '../../context/AppContext';
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

  // Recharts Data
  const payrollTrendData = [
    { period: 'T05/26', cost: 102.5 },
    { period: 'T06/26', cost: 104.0 },
    { period: 'T07/26', cost: 106.2 },
    { period: 'T08/26', cost: 107.5 },
    { period: 'T09/26 (Dự tính)', cost: 108.2 },
  ];

  const punctualityData = [
    { week: 'Tuần 33', rate: 94.2 },
    { week: 'Tuần 34', rate: 95.8 },
    { week: 'Tuần 35', rate: 96.0 },
    { week: 'Tuần 36', rate: 97.4 },
    { week: 'Tuần 37', rate: 98.1 },
  ];

  const methodBreakdown = [
    { name: 'Khuôn mặt (Face ID 512D)', value: 88, color: '#3b82f6' },
    { name: 'Vân tay (Fingerprint)', value: 10, color: '#22c55e' },
    { name: 'Thủ công (Manual Kiosk)', value: 2, color: '#f59e0b' },
  ];

  const handleExportCSV = () => {
    // Generate real CSV text
    const headers = ['Mã NV', 'Họ và Tên', 'Phòng Ban', 'Vị trí', 'Email', 'Trạng Thái', 'Lương Cơ Bản (VNĐ)', 'Face ID', 'Vân Tay'];
    
    const rows = employees.map(emp => [
      emp.employee_id,
      `"${emp.full_name}"`,
      `"${emp.department}"`,
      `"${emp.position}"`,
      emp.email,
      emp.status,
      emp.base_salary || 0,
      emp.face_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA',
      emp.fingerprint_enrolled ? 'ĐÃ ĐĂNG KÝ' : 'CHƯA'
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Create Blob and trigger download
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Bao_cao_cham_cong_AIoT_${new Date().toISOString().split('T')[0]}.csv`);
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
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Báo Cáo & Thống Kê Chuyên Cần
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              ANALYTICS ENGINE
            </span>
          </div>
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
              <p className="text-xs text-slate-400">Tổng ngân sách chi trả 5 tháng gần nhất</p>
            </div>
            <span className="text-xs font-mono text-blue-400 font-bold">+1.2% / tháng</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payrollTrendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[90, 120]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="cost" name="Quỹ lương (Triệu ₫)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Punctuality Rate Area Chart */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                Tỷ lệ đi làm đúng giờ theo tuần (%)
              </h2>
              <p className="text-xs text-slate-400">Đo lường mức độ tuân thủ nội quy</p>
            </div>
            <span className="text-xs font-mono text-green-500 font-bold">98.1% (Tuần này)</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={punctualityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="punctualityColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="week" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} domain={[90, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="rate" name="Tỷ lệ đúng giờ" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#punctualityColor)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
                <span className="font-mono font-bold text-white">{m.value}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Leaderboard */}
        <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-heading">
              Bảng Xếp Hạng Chuyên Cần Tháng 09
            </h2>
            <span className="text-xs text-slate-400">Đánh giá chuẩn KPI</span>
          </div>

          <div className="space-y-3">
            {[
              { rank: 1, name: 'Nguyễn Văn A', dept: 'Kỹ thuật AI', rate: '100%', onTime: '19/19 ngày', badge: 'XUẤT SẮC' },
              { rank: 2, name: 'Nguyễn Minh Anh', dept: 'Nhân sự & HR', rate: '100%', onTime: '19/19 ngày', badge: 'XUẤT SẮC' },
              { rank: 3, name: 'Lê Hoàng Phúc', dept: 'Vận hành & IT', rate: '98.5%', onTime: '18/19 ngày', badge: 'TỐT' },
              { rank: 4, name: 'Trần Thu Thảo', dept: 'Kỹ thuật AI', rate: '97.0%', onTime: '18/19 ngày', badge: 'TỐT' },
              { rank: 5, name: 'Nguyễn Hải Nam', dept: 'Vận hành & IT', rate: '89.5%', onTime: '16/19 ngày', badge: 'CẦN LƯU Ý' },
            ].map(item => (
              <div
                key={item.name}
                className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/80 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                      item.rank === 1
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : item.rank === 2
                        ? 'bg-slate-700/20 text-slate-200 border border-slate-700/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    #{item.rank}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.name}</p>
                    <p className="text-[10px] text-slate-400">{item.dept} • {item.onTime}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-blue-400">{item.rate}</span>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      item.badge === 'XUẤT SẮC'
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                        : item.badge === 'TỐT'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
