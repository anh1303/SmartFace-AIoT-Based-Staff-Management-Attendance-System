import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
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
  const { currentUser, workShifts, attendance, showToast } = useApp();
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [explainReason, setExplainReason] = useState('');
  const [explainDate, setExplainDate] = useState('2026-09-10');

  // Staff's upcoming shifts
  const myShifts = workShifts
    .filter(s => s.employee_id === (currentUser?.employee_id || 'NV-001'))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Staff's recent attendance
  const myAttendance = attendance
    .filter(a => a.employee_id === (currentUser?.employee_id || 'NV-001'))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const latestPunch = myAttendance[0];

  const handleExplainSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Đã gửi đơn giải trình chấm công đến quản lý!', 'success');
    setExplainModalOpen(false);
    setExplainReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Greeting & Biometric Punch Status (Bento Header) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={currentUser?.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120"}
              alt={currentUser?.full_name}
              className="w-16 h-16 rounded-2xl object-cover border border-slate-700"
            />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-slate-900 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
                Xin chào, {currentUser?.full_name || 'Nguyễn Văn A'}
              </h1>
              <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {currentUser?.employee_id || 'NV-001'}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
              <span>{currentUser?.department || 'Kỹ thuật AI'}</span>
              <span>•</span>
              <span className="text-green-500 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Hôm nay: Check-in {latestPunch ? new Date(latestPunch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '08:02'} (Đúng giờ)
              </span>
            </p>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Xác thực: 99.8% Match • Main Lobby - AI Cam 01
            </p>
          </div>
        </div>

        {/* Quick actions for staff */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setExplainModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>Gửi giải trình</span>
          </button>
          <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-blue-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>Đã làm: 05h 24m</span>
          </div>
        </div>
      </div>

      {/* 4 Bento Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hôm nay */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Hôm nay (Ca hành chính)
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">08:02 - 17:30</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 uppercase font-mono">
                Đúng giờ
              </span>
              <span className="text-xs text-slate-500">0 trễ • 0 sớm</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tuần này */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Tổng giờ tuần này
          </span>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">32.5</span>
              <span className="text-xs text-slate-500 font-mono">/ 40.0h (81%)</span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded-full mt-2.5 overflow-hidden border border-slate-800">
              <div className="bg-blue-500 h-full rounded-full" style={{ width: '81%' }} />
            </div>
            <p className="text-[11px] text-green-500 mt-2 flex items-center gap-1 font-medium">
              <ArrowUpRight className="w-3 h-3" /> +3.2h so với tuần trước
            </p>
          </div>
        </div>

        {/* Card 3: Công tháng */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Ngày công tháng 09
          </span>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">19</span>
              <span className="text-xs text-slate-500 font-mono">/ 22 ngày</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 uppercase font-mono">
                100% Chuyên cần
              </span>
              <span className="text-xs text-slate-500">0 vắng mặt</span>
            </div>
          </div>
        </div>

        {/* Card 4: Lương tạm tính */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">
            Lương tạm tính kỳ này
          </span>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono text-white">
              18.450.000₫
            </div>
            <p className="text-[11px] text-orange-400 mt-2 font-medium">
              Đã bao gồm +2.5h OT được duyệt
            </p>
          </div>
        </div>
      </div>

      {/* Week Attendance Rhythm Bento Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Nhịp điệu chấm công tuần này (Tuần 37)
            </h2>
            <p className="text-xs text-slate-400">Tự động ghi nhận qua camera nhận diện khuôn mặt</p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            07/09 - 13/09/2026
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { day: 'Thứ 2', date: '07/09', in: '08:04', out: '17:35', status: 'ON_TIME', type: 'Chuẩn ca' },
            { day: 'Thứ 3', date: '08/09', in: '08:00', out: '19:30', status: 'ON_TIME', type: 'Ca + OT 2h' },
            { day: 'Thứ 4', date: '09/09', in: '08:01', out: '17:32', status: 'ON_TIME', type: 'Chuẩn ca' },
            { day: 'Thứ 5 (Nay)', date: '10/09', in: '08:02', out: 'Đang làm...', status: 'ACTIVE', type: 'Chuẩn ca' },
            { day: 'Thứ 6', date: '11/09', in: '--:--', out: '--:--', status: 'UPCOMING', type: 'Chuẩn ca' },
            { day: 'Thứ 7', date: '12/09', in: '--:--', out: '--:--', status: 'UPCOMING', type: 'OT Tự chọn' },
            { day: 'Chủ Nhật', date: '13/09', in: '--:--', out: '--:--', status: 'OFF', type: 'Nghỉ tuần' },
          ].map((item, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-2xl border text-xs transition-all ${
                item.status === 'ACTIVE'
                  ? 'bg-blue-600/10 border-blue-500'
                  : item.status === 'ON_TIME'
                  ? 'bg-slate-950 border-slate-800'
                  : item.status === 'OFF'
                  ? 'bg-slate-950 border-slate-800/40 opacity-40'
                  : 'bg-slate-950 border-slate-800/70'
              }`}
            >
              <div className="flex justify-between items-center text-slate-500 text-[11px] mb-1">
                <span>{item.day}</span>
                <span className="font-mono">{item.date}</span>
              </div>
              <p className="font-mono font-bold text-white text-sm">
                {item.in}
              </p>
              <p className="text-[11px] text-slate-400 font-mono">
                Ra: {item.out}
              </p>
              <div className="mt-2 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">{item.type}</span>
                {item.status === 'ON_TIME' && (
                  <span className="text-[10px] text-green-500 font-semibold font-mono">Đúng giờ</span>
                )}
                {item.status === 'ACTIVE' && (
                  <span className="text-[10px] text-blue-400 font-semibold animate-pulse font-mono">Đang ca</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Two-Column Bento Lower Section */}
      <div className="grid lg:grid-cols-12 gap-4">
        {/* Left Bento: Biometrics */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white font-heading">
              Sinh trắc học cá nhân
            </h2>
            <span className="text-xs text-green-500 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-4 h-4" /> Đã kích hoạt
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <ScanFace className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Vector Face ID 512-D</p>
              <p className="text-[11px] text-slate-400">Đã đăng ký 3 góc khuôn mặt tại Gate A</p>
              <span className="inline-block mt-1 text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                ACTIVE • LIVENESS 3D
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 shrink-0">
              <Fingerprint className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">Vân tay FAP30 Chuẩn FBI</p>
              <p className="text-[11px] text-slate-400">Phương thức dự phòng tại máy chấm công</p>
              <span className="inline-block mt-1 text-[10px] font-mono text-green-500 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                ACTIVE • 2 NGÓN TRỎ
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
            <span className="font-semibold text-blue-400">Lưu ý an ninh:</span> Dữ liệu khuôn mặt được mã hoá một chiều chuẩn AES-256 nội bộ, không lưu trữ ảnh thô trên cloud.
          </div>
        </div>

        {/* Right Bento: Upcoming shifts */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-white font-heading">
                  Ca làm việc tiếp theo
                </h2>
                <p className="text-xs text-slate-400">Lịch phân bổ từ Trưởng bộ phận</p>
              </div>
              <span className="text-xs text-blue-400 font-medium">3 ca sắp tới</span>
            </div>

            <div className="space-y-3">
              {myShifts.slice(0, 3).map((shift, idx) => (
                <div
                  key={shift.shift_id || idx}
                  className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 flex flex-col items-center justify-center font-mono text-xs">
                      <span className="text-[10px] text-slate-400">T9</span>
                      <span className="font-bold text-white">{shift.date.split('-')[2]}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">
                        {shift.shift_type === 'OFFICE_HOURS'
                          ? 'Ca Hành Chính'
                          : shift.shift_type === 'MORNING'
                          ? 'Ca Sáng'
                          : shift.shift_type === 'AFTERNOON'
                          ? 'Ca Chiều'
                          : 'Nghỉ ca'}
                        {shift.note ? ` • ${shift.note}` : ''}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400">
                        {shift.start_time} - {shift.end_time} • {shift.department}
                      </p>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                    ĐÃ XÁC NHẬN
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Cần đổi ca hoặc báo vắng?</span>
            <button
              type="button"
              onClick={() => setExplainModalOpen(true)}
              className="text-blue-500 hover:text-blue-400 font-medium"
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
            <label className="block text-xs font-semibold text-slate-300 mb-1">Chọn ngày cần giải trình</label>
            <input
              type="date"
              value={explainDate}
              onChange={e => setExplainDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Loại yêu cầu</label>
            <select className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white">
              <option>Quên chấm công (Điểm danh bù)</option>
              <option>Giải trình đi muộn / Về sớm do công tác</option>
              <option>Đăng ký đổi ca trực với đồng đội</option>
              <option>Đăng ký tăng ca làm thêm (OT)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Lý do chi tiết & Minh chứng</label>
            <textarea
              rows={3}
              required
              value={explainReason}
              onChange={e => setExplainReason(e.target.value)}
              placeholder="Ghi rõ lý do và đính kèm thời gian dự kiến..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setExplainModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
            >
              Gửi đơn phê duyệt
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
