import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Users, 
  ArrowLeftRight, 
  FileText, 
  ShieldCheck, 
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';

export const StaffSchedule: React.FC = () => {
  const { currentUser, workShifts, employees, showToast } = useApp();
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [exchangeTargetEmp, setExchangeTargetEmp] = useState('');
  const [exchangeDate, setExchangeDate] = useState('2026-09-11');
  const [exchangeReason, setExchangeReason] = useState('');

  // Current staff's shifts
  const myShifts = workShifts.filter(
    s => s.employee_id === (currentUser?.employee_id || 'NV-001')
  );

  // Teammates in same department or on duty today
  const teammates = employees.filter(
    e => e.employee_id !== (currentUser?.employee_id || 'NV-001') && e.status === 'ACTIVE'
  );

  const handleExchangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Đã gửi yêu cầu đổi ca trực đến Quản lý xét duyệt!', 'success');
    setExchangeModalOpen(false);
    setExchangeReason('');
  };

  const daysOfWeek = [
    { name: 'Thứ 2', date: '2026-09-07', label: '07/09' },
    { name: 'Thứ 3', date: '2026-09-08', label: '08/09' },
    { name: 'Thứ 4', date: '2026-09-09', label: '09/09' },
    { name: 'Thứ 5 (Hôm nay)', date: '2026-09-10', label: '10/09' },
    { name: 'Thứ 6', date: '2026-09-11', label: '11/09' },
    { name: 'Thứ 7', date: '2026-09-12', label: '12/09' },
    { name: 'Chủ Nhật', date: '2026-09-13', label: '13/09' },
  ];

  return (
    <div className="space-y-6">
      {/* Bento Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Lịch trình làm việc & Phân bổ ca
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              TUẦN 37 • 2026
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Xem lịch làm việc cá nhân, thông tin điểm danh và danh sách đồng đội cùng ca.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExchangeModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md transition-all"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Đổi ca trực</span>
          </button>
        </div>
      </div>

      {/* 4 Bento Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tổng giờ dự kiến</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">40.0h</div>
          <p className="text-[11px] text-blue-400 mt-1">05 ca tiêu chuẩn</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Số ca hoàn thành</span>
          <div className="mt-2 text-2xl font-bold font-mono text-green-500">04 / 5 ca</div>
          <p className="text-[11px] text-slate-500 mt-1">Đạt 80% tiến độ tuần</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Ca làm thêm (OT)</span>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-400">01 ca (4h)</div>
          <p className="text-[11px] text-amber-400/80 mt-1">Thứ 7 • Đã phê duyệt</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Tỷ lệ đúng giờ</span>
          <div className="mt-2 text-2xl font-bold font-mono text-white">100%</div>
          <p className="text-[11px] text-green-500 mt-1">0 trễ • 0 vắng mặt</p>
        </div>
      </div>

      {/* Weekly Detailed Bento Grid */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white font-heading">
            Chi tiết các ca trong tuần (07/09 - 13/09/2026)
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono">Tuần hiện tại</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
          {daysOfWeek.map((day) => {
            const shift = myShifts.find(s => s.date === day.date);
            const isToday = day.date === '2026-09-10';
            const isPast = day.date < '2026-09-10';

            return (
              <div
                key={day.date}
                className={`p-4 rounded-2xl border flex flex-col justify-between min-h-[190px] transition-all ${
                  isToday
                    ? 'bg-blue-950/30 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                    : shift?.shift_type === 'OFF'
                    ? 'bg-slate-950 border-slate-800/60 opacity-60'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs font-semibold text-white">{day.name}</p>
                      <p className="text-[11px] font-mono text-slate-500">{day.label}</p>
                    </div>
                    {isToday && (
                      <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-md">
                        HÔM NAY
                      </span>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-bold text-blue-400">
                      {shift?.shift_type === 'OFFICE_HOURS'
                        ? 'Ca Hành Chính'
                        : shift?.shift_type === 'MORNING'
                        ? 'Ca Sáng'
                        : shift?.shift_type === 'AFTERNOON'
                        ? 'Ca Chiều'
                        : 'Nghỉ Ca'}
                    </p>
                    {shift?.shift_type !== 'OFF' && (
                      <p className="text-[11px] font-mono text-slate-300 mt-1">
                        {shift?.start_time} - {shift?.end_time}
                      </p>
                    )}
                    {shift?.note && (
                      <p className="text-[10px] text-slate-400 mt-1 italic">
                        {shift.note}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/80">
                  {isPast ? (
                    <span className="text-[10px] font-semibold text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Đã hoàn thành
                    </span>
                  ) : isToday ? (
                    <span className="text-[10px] font-semibold text-blue-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 animate-spin" /> Đang trực ca
                    </span>
                  ) : shift?.shift_type === 'OFF' ? (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Nghỉ tuần
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono">
                      Sắp diễn ra
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Lower Section: Teammates on duty today */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white font-heading">
              Đồng đội cùng ca trực hôm nay (10/09/2026)
            </h2>
            <p className="text-xs text-slate-400">Danh sách nhân sự đang cùng làm việc tại trụ sở</p>
          </div>
          <span className="text-xs text-blue-400 font-mono">{teammates.length} nhân sự trực ca</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teammates.map(emp => (
            <div
              key={emp.employee_id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <img
                  src={emp.avatar}
                  alt={emp.full_name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-700"
                />
                <div>
                  <p className="text-xs font-semibold text-white">{emp.full_name}</p>
                  <p className="text-[11px] text-slate-400">{emp.position}</p>
                  <span className="text-[10px] font-mono text-blue-400">{emp.department}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                  ONLINE
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Exchange Shift Modal */}
      <Modal
        isOpen={exchangeModalOpen}
        onClose={() => setExchangeModalOpen(false)}
        title="Đăng ký Đổi ca trực / Làm thay"
        subtitle="Yêu cầu cần được sự đồng ý của cả 2 bên và Trưởng bộ phận"
      >
        <form onSubmit={handleExchangeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Chọn ngày cần đổi ca</label>
            <input
              type="date"
              value={exchangeDate}
              onChange={e => setExchangeDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Đồng đội muốn đổi ca cùng</label>
            <select
              value={exchangeTargetEmp}
              onChange={e => setExchangeTargetEmp(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="">-- Chọn đồng đội --</option>
              {teammates.map(t => (
                <option key={t.employee_id} value={t.employee_id}>
                  {t.full_name} ({t.employee_id} - {t.department})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Lý do đổi ca</label>
            <textarea
              rows={3}
              required
              value={exchangeReason}
              onChange={e => setExchangeReason(e.target.value)}
              placeholder="Ghi rõ lý do (ví dụ: bận việc gia đình, đã thỏa thuận trực thay ngày 12/09)..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setExchangeModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
            >
              Gửi yêu cầu đổi ca
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
