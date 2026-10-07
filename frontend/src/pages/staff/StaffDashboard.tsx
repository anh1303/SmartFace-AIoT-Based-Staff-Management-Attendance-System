import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatVNTime, getTodayVNString, formatVNDateISO } from '../../utils/dateUtils';
import {
  Clock,
  CheckCircle2,
  Calendar,
  TrendingUp,
  ScanFace,
  Fingerprint,
  ArrowUpRight,
  FileText,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const StaffDashboard: React.FC = () => {
  const { currentUser, workShifts, attendance, payroll, employees, bonusPenalty, showToast } = useApp();
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [explainReason, setExplainReason] = useState('');
  const [explainDate, setExplainDate] = useState(() => getTodayVNString());

  const empCode = currentUser?.employee_id || 'NV-001';
  const currentEmp = employees.find(e => e.employee_id === empCode);

  // Staff's upcoming shifts
  const myShifts = workShifts
    .filter(s => s.employee_id === empCode)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Staff's recent attendance
  const myAttendance = attendance
    .filter(a => a.employee_id === empCode)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestPunch = myAttendance[0];
  const todayShift = myShifts.find(s => s.date === getTodayVNString()) || myShifts[0];

  // Distinct attendance dates
  const attendedDates = Array.from(new Set(myAttendance.map(a => formatVNDateISO(a.timestamp))));
  const workDaysCount = attendedDates.length;

  // Current period payroll record
  const currentPayroll = payroll.find(p => p.employee_id === empCode) || payroll[0];
  const netSalaryFormatted = currentPayroll
    ? Number(currentPayroll.net_salary || 0).toLocaleString('vi-VN') + '₫'
    : ((currentEmp?.hourly_rate || 120000) * 160).toLocaleString('vi-VN') + '₫';

  // Dynamic 7-day week rhythm
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };
  const monday = getMonday(new Date());
  const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

  const weekRhythm = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + offset);
    const dateStr = formatVNDateISO(d);
    const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const dayShift = myShifts.find(s => s.date === dateStr);
    const dayPunches = myAttendance.filter(a => formatVNDateISO(a.timestamp) === dateStr);
    const inPunch = dayPunches.find(a => a.type === 'CHECK_IN') || dayPunches[dayPunches.length - 1];
    const outPunch = dayPunches.find(a => a.type === 'CHECK_OUT');

    let status = 'UPCOMING';
    let inText = '--:--';
    let outText = '--:--';

    if (dayShift?.shift_type === 'OFF') {
      status = 'OFF';
    } else if (inPunch) {
      const inPunc = inPunch.punctuality || (inPunch.status === 'VALID' ? 'ON_TIME' : inPunch.status);
      status = inPunc === 'ON_TIME' ? 'ON_TIME' : 'LATE';
      inText = formatVNTime(inPunch.timestamp, false);
      outText = outPunch ? formatVNTime(outPunch.timestamp, false) : (dateStr === getTodayVNString() ? 'Đang ca...' : '--:--');
    }

    return {
      day: dayNames[offset],
      date: dayLabel,
      fullDate: dateStr,
      in: inText,
      out: outText,
      status,
      type: dayShift?.shift_type === 'OFFICE_HOURS' ? 'Ca Chuẩn' : dayShift?.shift_type === 'MORNING' ? 'Ca Sáng' : dayShift?.shift_type === 'AFTERNOON' ? 'Ca Chiều' : 'Nghỉ ca',
    };
  });

  const handleExplainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Đã gửi đơn giải trình chấm công đến quản lý!', 'success');
    setExplainModalOpen(false);
    setExplainReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Greeting & Biometric Punch Status (Bento Header with Continuous Shifting Gradient & Floating Blobs) */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative">
            <img
              src={currentUser?.avatar || currentEmp?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"}
              alt={currentUser?.full_name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-purple-400 dark:border-purple-600 shadow-md"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#13162b] flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-heading tracking-tight">
                Xin chào, {currentUser?.full_name || currentEmp?.full_name || 'Nguyễn Văn A'} 👋
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50">
                {empCode}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-2">
              <span>{currentUser?.department || currentEmp?.department || 'Nhân viên'}</span>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Mới nhất: {latestPunch ? `${latestPunch.type === 'CHECK_IN' ? 'Check-in' : 'Check-out'} ${formatVNTime(latestPunch.timestamp, false)} (${(latestPunch.punctuality || (latestPunch.status === 'VALID' ? 'ON_TIME' : latestPunch.status)) === 'ON_TIME' ? 'Đúng giờ' : 'Trễ/Sớm'})` : 'Chưa có lượt quẹt hôm nay'}
              </span>
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              Xác thực: {latestPunch ? `${(latestPunch.verification_score * 100).toFixed(1)}% Match • ${latestPunch.device_id}` : 'AI Face Recognition Node 01'}
            </p>
          </div>
        </div>

        {/* Quick actions for staff */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setExplainModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white/80 dark:bg-[#181c38]/90 hover:bg-white dark:hover:bg-[#20254b] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-purple-200/80 dark:border-[#272d5a] backdrop-blur-sm transition-colors cursor-pointer shadow-xs"
          >
            <FileText className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Gửi giải trình</span>
          </button>
          <div className="px-3.5 py-2 rounded-xl bg-purple-50/80 dark:bg-[#0f1224]/80 border border-purple-200/80 dark:border-[#272d5a] text-xs font-mono text-purple-600 dark:text-purple-400 flex items-center gap-1.5 shadow-xs">
            <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 animate-pulse" />
            <span>Đã ghi nhận: {myAttendance.length} lượt</span>
          </div>
        </div>
      </div>

      {/* 4 Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hôm nay */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Hôm nay ({todayShift ? todayShift.shift_type : 'Hành chính'})
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {todayShift ? `${todayShift.start_time} - ${todayShift.end_time}` : '08:00 - 18:00'}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 uppercase font-mono border border-purple-200 dark:border-purple-700/50">
                {todayShift?.work_day || 'Thứ Hai'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[130px]">{todayShift?.note || 'Đúng tiến độ'}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tuần này */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Lịch phân ca tuần
          </span>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{myShifts.length}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">ca đã đăng ký</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-[#0f1224] h-2 rounded-full mt-2.5 overflow-hidden border border-slate-200 dark:border-[#272d5a]">
              <div className="bg-purple-600 h-full rounded-full" style={{ width: `${Math.min(100, (myShifts.length / 7) * 100)}%` }} />
            </div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3 h-3" /> Đầy đủ phân bổ
            </p>
          </div>
        </div>

        {/* Card 3: Công tháng */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Ngày công tích lũy
          </span>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-slate-900 dark:text-white">{workDaysCount}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">ngày có điểm danh</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 uppercase font-mono border border-emerald-200 dark:border-emerald-800/40">
                {myAttendance.filter(a => (a.punctuality || (a.status === 'VALID' ? 'ON_TIME' : a.status)) === 'ON_TIME').length} lượt chuẩn giờ
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Lương tạm tính */}
        <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col justify-between hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors shadow-xs">
          <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Lương tạm tính kỳ này
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
              {netSalaryFormatted}
            </div>
            <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-2 font-medium">
              Lương/giờ: {Number(currentEmp?.hourly_rate || 120000).toLocaleString('vi-VN')} ₫/h
            </p>
          </div>
        </div>
      </div>

      {/* Week Attendance Rhythm Bento Card */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Nhịp điệu chấm công tuần này
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Tự động ghi nhận qua camera nhận diện khuôn mặt & vân tay</p>
          </div>
          <span className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-[#0f1224] px-3 py-1 rounded-xl border border-slate-200 dark:border-[#272d5a]">
            {weekRhythm[0]?.date} - {weekRhythm[6]?.date}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {weekRhythm.map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border text-xs transition-all ${item.status === 'ON_TIME'
                ? 'bg-slate-50 dark:bg-[#0f1224] border-slate-200/80 dark:border-[#21264b] hover:border-purple-400 dark:hover:border-purple-600'
                : item.status === 'LATE'
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-500/40'
                  : item.status === 'OFF'
                    ? 'bg-slate-50/40 dark:bg-[#0f1224]/40 border-slate-100 dark:border-[#21264b]/40 opacity-60'
                    : 'bg-slate-50 dark:bg-[#0f1224] border-slate-200/80 dark:border-[#21264b]'
                }`}
            >
              <div className="flex justify-between items-center text-slate-400 text-[11px] mb-1">
                <span>{item.day}</span>
                <span className="font-mono">{item.date}</span>
              </div>
              <p className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                {item.in}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Ra: {item.out}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-[#21264b] flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{item.type}</span>
                {item.status === 'ON_TIME' && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">Đúng giờ</span>
                )}
                {item.status === 'LATE' && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold font-mono">Lệch ca</span>
                )}
                {item.status === 'OFF' && (
                  <span className="text-[10px] text-slate-400 font-mono">Nghỉ ca</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column Bento Lower Section */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Left Bento: Biometrics */}
        <div className="lg:col-span-5 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Sinh trắc học cá nhân
            </h2>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-4 h-4" /> Đã kích hoạt
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/40 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
              <ScanFace className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Vector Face ID 512-D</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Đã đăng ký 3 góc khuôn mặt tại Gate A</p>
              <span className="inline-block mt-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                ACTIVE • LIVENESS 3D
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Vân tay FAP30 Chuẩn FBI</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Phương thức dự phòng tại máy chấm công</p>
              <span className="inline-block mt-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/40">
                ACTIVE • 2 NGÓN TRỎ
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] rounded-xl text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-purple-600 dark:text-purple-400">Lưu ý an ninh:</span> Dữ liệu khuôn mặt được mã hoá một chiều chuẩn AES-256 nội bộ, không lưu trữ ảnh thô trên cloud.
          </div>
        </div>

        {/* Right Bento: Upcoming shifts */}
        <div className="lg:col-span-7 bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white font-heading">
                  Ca làm việc tiếp theo
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lịch phân bổ từ Trưởng bộ phận</p>
              </div>
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">3 ca sắp tới</span>
            </div>

            <div className="space-y-3">
              {myShifts.slice(0, 3).map((shift, idx) => (
                <div
                  key={shift.shift_id || idx}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200/80 dark:border-[#21264b] flex items-center justify-between hover:border-purple-300 dark:hover:border-purple-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700/40 flex flex-col items-center justify-center font-mono text-xs">
                      <span className="text-[10px] text-slate-400">T9</span>
                      <span className="font-bold text-slate-900 dark:text-white">{shift.date.split('-')[2]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        {shift.shift_type === 'OFFICE_HOURS'
                          ? 'Ca Hành Chính'
                          : shift.shift_type === 'MORNING'
                            ? 'Ca Sáng'
                            : shift.shift_type === 'AFTERNOON'
                              ? 'Ca Chiều'
                              : 'Nghỉ ca'}
                        {shift.note ? ` • ${shift.note}` : ''}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {shift.start_time} - {shift.end_time} • {shift.department}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700/50 font-mono">
                    ĐÃ XÁC NHẬN
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-[#21264b] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Cần đổi ca hoặc báo vắng?</span>
            <button
              type="button"
              onClick={() => setExplainModalOpen(true)}
              className="text-purple-600 dark:text-purple-400 hover:underline font-medium cursor-pointer"
            >
              Gửi yêu cầu đổi ca &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Modal giải trình / đổi ca */}
      <Modal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        title="Gửi đơn giải trình / Đổi ca"
        subtitle="Đơn sẽ được gửi trực tiếp đến Trưởng bộ phận xét duyệt"
      >
        <form onSubmit={handleExplainSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Chọn ngày cần giải trình</label>
            <input
              type="date"
              value={explainDate}
              onChange={e => setExplainDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại yêu cầu</label>
            <select className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer">
              <option className="bg-white dark:bg-[#13162b]">Quên chấm công (Điểm danh bù)</option>
              <option className="bg-white dark:bg-[#13162b]">Giải trình đi muộn / Về sớm do công tác</option>
              <option className="bg-white dark:bg-[#13162b]">Đăng ký đổi ca trực với đồng đội</option>
              <option className="bg-white dark:bg-[#13162b]">Đăng ký tăng ca làm thêm (OT)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Lý do chi tiết & Minh chứng</label>
            <textarea
              rows={3}
              required
              value={explainReason}
              onChange={e => setExplainReason(e.target.value)}
              placeholder="Ghi rõ lý do và đính kèm thời gian dự kiến..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => setExplainModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 cursor-pointer"
            >
              Gửi đơn phê duyệt
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};