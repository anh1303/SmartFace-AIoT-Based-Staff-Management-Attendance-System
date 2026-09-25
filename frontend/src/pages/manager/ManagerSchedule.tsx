import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CalendarRange,
  Clock,
  Users,
  CheckCircle2,
  Filter,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Edit3
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { WorkShift } from '../../types';

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function formatDateToYYYYMMDD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getISOWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export const ManagerSchedule: React.FC = () => {
  const { employees, workShifts, assignOrUpdateShift, showToast } = useApp();
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [editingShift, setEditingShift] = useState<{
    employeeId: string;
    employeeName: string;
    date: string;
    dayLabel: string;
    shift: WorkShift | undefined;
  } | null>(null);

  // Solar Calendar Week State (Default Monday of current week)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));

  // Form state inside modal
  const [modalShiftType, setModalShiftType] = useState<WorkShift['shift_type']>('OFFICE_HOURS');
  const [modalStartTime, setModalStartTime] = useState('08:00');
  const [modalEndTime, setModalEndTime] = useState('17:30');
  const [modalNote, setModalNote] = useState('');

  const daysOfWeek = [0, 1, 2, 3, 4, 5, 6].map(offset => {
    const d = new Date(currentMonday);
    d.setDate(currentMonday.getDate() + offset);
    const dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const dateStr = formatDateToYYYYMMDD(d);
    const dayNum = String(d.getDate()).padStart(2, '0');
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    return {
      name: dayNames[offset],
      date: dateStr,
      label: `${dayNum}/${monthNum}`,
    };
  });

  const weekNumber = getISOWeekNumber(currentMonday);
  const startDateObj = currentMonday;
  const endDateObj = new Date(currentMonday);
  endDateObj.setDate(currentMonday.getDate() + 6);

  const startLabel = `${String(startDateObj.getDate()).padStart(2, '0')}/${String(startDateObj.getMonth() + 1).padStart(2, '0')}`;
  const endLabel = `${String(endDateObj.getDate()).padStart(2, '0')}/${String(endDateObj.getMonth() + 1).padStart(2, '0')}`;

  const handlePrevWeek = () => {
    const prev = new Date(currentMonday);
    prev.setDate(currentMonday.getDate() - 7);
    setCurrentMonday(prev);
  };

  const handleNextWeek = () => {
    const next = new Date(currentMonday);
    next.setDate(currentMonday.getDate() + 7);
    setCurrentMonday(next);
  };

  const handleDateSelect = (dateString: string) => {
    if (!dateString) return;
    const selected = new Date(dateString);
    if (!isNaN(selected.getTime())) {
      setCurrentMonday(getMonday(selected));
    }
  };

  const filteredEmployees = employees.filter(e => {
    if (departmentFilter !== 'ALL' && e.department !== departmentFilter) return false;
    return true;
  });

  const handleCellClick = (empId: string, empName: string, date: string, dayLabel: string) => {
    const targetEmp = employees.find(e => e.employee_id === empId);
    if (targetEmp?.status === 'INACTIVE') {
      showToast(`Nhân viên ${empName} đang ở trạng thái TẠM NGƯNG, không thể phân bổ hoặc chỉnh sửa ca làm việc!`, 'warning');
      return;
    }

    const existing = workShifts.find(s => s.employee_id === empId && s.date === date);
    setEditingShift({
      employeeId: empId,
      employeeName: empName,
      date,
      dayLabel,
      shift: existing
    });

    if (existing) {
      setModalShiftType(existing.shift_type);
      setModalStartTime(existing.start_time);
      setModalEndTime(existing.end_time);
      setModalNote(existing.note || '');
    } else {
      setModalShiftType('OFFICE_HOURS');
      setModalStartTime('08:00');
      setModalEndTime('17:30');
      setModalNote('');
    }
  };

  const handleShiftSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShift) return;

    const emp = employees.find(e => e.employee_id === editingShift.employeeId);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayIndex = new Date(`${editingShift.date}T00:00:00.000Z`).getUTCDay();
    const workDay = editingShift.shift?.work_day || dayNames[dayIndex];

    assignOrUpdateShift({
      shift_id: editingShift.shift?.shift_id,
      employee_id: editingShift.employeeId,
      date: editingShift.date,
      work_day: workDay,
      start_time: modalShiftType === 'OFF' ? '00:00' : modalStartTime,
      end_time: modalShiftType === 'OFF' ? '00:00' : modalEndTime,
      shift_type: modalShiftType,
      department: emp?.department || 'Nhân viên',
      note: modalNote,
    });

    setEditingShift(null);
  };

  const renderShiftBadge = (shift: WorkShift | undefined) => {
    if (!shift || shift.shift_type === 'OFF') {
      return (
        <div className="p-2 rounded-xl bg-slate-950 text-slate-500 text-[11px] text-center border border-slate-800/80 group-hover:border-slate-700 transition-colors">
          Nghỉ ca (OFF)
        </div>
      );
    }

    let colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    let typeName = 'Hành chính';

    if (shift.shift_type === 'MORNING') {
      colorClass = 'bg-sky-500/10 text-sky-400 border-sky-500/20';
      typeName = 'Ca Sáng';
    } else if (shift.shift_type === 'AFTERNOON') {
      colorClass = 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      typeName = 'Ca Chiều';
    }

    return (
      <div className={`p-2 rounded-xl border text-[11px] text-left transition-all ${colorClass}`}>
        <p className="font-bold">{typeName}</p>
        <p className="font-mono text-[10px] opacity-90">{shift.start_time} - {shift.end_time}</p>
        {shift.note && <p className="text-[9px] truncate opacity-75 mt-0.5">{shift.note}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Bento Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white font-heading tracking-tight">
              Sắp Xếp & Phân Bổ Ca Làm Việc
            </h1>
            {/* Interactive Solar Calendar Week Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-2xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={handlePrevWeek}
                title="Tuần trước"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="relative flex items-center gap-1.5 font-mono text-xs text-blue-400 font-semibold px-2 cursor-pointer group" title="Bấm để chọn tuần theo lịch dương">
                <CalendarRange className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                <span>TUẦN {weekNumber} ({startLabel} - {endLabel})</span>
                <input
                  type="date"
                  value={formatDateToYYYYMMDD(currentMonday)}
                  onChange={e => handleDateSelect(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
              </div>

              <button
                type="button"
                onClick={handleNextWeek}
                title="Tuần sau"
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Bấm vào bất kỳ ô ca trực nào để phân bổ hoặc điều chỉnh giờ làm cho nhân viên.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Chức vụ:</span>
          </div>
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả chức vụ</option>
            <option value="Bảo vệ">Bảo vệ</option>
            <option value="Nhân viên">Nhân viên</option>
            <option value="Thu ngân">Thu ngân</option>
            <option value="Quản lý">Quản lý</option>
          </select>
        </div>
      </div>

      {/* Interactive Shift Matrix Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-4 px-4 w-52 sticky left-0 bg-slate-950 z-10 border-r border-slate-800">
                  Nhân sự ({filteredEmployees.length})
                </th>
                {daysOfWeek.map(d => (
                  <th key={d.date} className="py-4 px-3 min-w-[130px] border-r border-slate-800/60 last:border-r-0">
                    <div className="font-bold text-white">{d.name}</div>
                    <div className="text-[10px] text-slate-500">{d.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {filteredEmployees.map(emp => {
                const isInactive = emp.status === 'INACTIVE';
                return (
                  <tr key={emp.employee_id} className={`transition-colors ${isInactive ? 'bg-slate-950/40 opacity-70' : 'hover:bg-slate-800/30'}`}>
                    {/* Employee Fixed Column */}
                    <td className="py-3 px-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp.avatar}
                          alt={emp.full_name}
                          className={`w-8 h-8 rounded-full object-cover border shrink-0 ${isInactive ? 'border-amber-500/50 grayscale' : 'border-slate-700'}`}
                        />
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-white truncate">{emp.full_name}</p>
                            {isInactive && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                TẠM NGƯNG
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-blue-400 truncate">{emp.employee_id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day Columns */}
                    {daysOfWeek.map(day => {
                      const shift = workShifts.find(
                        s => s.employee_id === emp.employee_id && s.date === day.date
                      );

                      return (
                        <td
                          key={day.date}
                          onClick={() => handleCellClick(emp.employee_id, emp.full_name, day.date, `${day.name} (${day.label})`)}
                          className={`py-2.5 px-2 border-r border-slate-800/60 last:border-r-0 ${isInactive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group hover:bg-blue-600/10'} transition-colors`}
                        >
                          {renderShiftBadge(shift)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bento Help legend */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="text-white font-semibold">Chú thích loại ca:</span>
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="w-2.5 h-2.5 rounded bg-sky-500" /> Ca Sáng (08:30 - 17:30)
          </span>
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2.5 h-2.5 rounded bg-blue-500" /> Hành Chính (08:00 - 17:30)
          </span>
          <span className="flex items-center gap-1.5 text-indigo-400">
            <span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Ca Chiều (13:00 - 21:30)
          </span>
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2.5 h-2.5 rounded bg-slate-700" /> Nghỉ ca
          </span>
        </div>
        <span className="text-blue-400 font-mono text-[11px]">Bấm vào ô để sửa ca</span>
      </div>

      {/* Edit Shift Modal */}
      <Modal
        isOpen={Boolean(editingShift)}
        onClose={() => setEditingShift(null)}
        title={`Phân bổ ca trực: ${editingShift?.employeeName}`}
        subtitle={`Ngày làm việc: ${editingShift?.dayLabel}`}
        maxWidth="md"
      >
        {editingShift && (
          <form onSubmit={handleShiftSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Loại ca làm việc</label>
              <select
                value={modalShiftType}
                onChange={e => {
                  const val = e.target.value as WorkShift['shift_type'];
                  setModalShiftType(val);
                  if (val === 'MORNING') {
                    setModalStartTime('08:30');
                    setModalEndTime('17:30');
                  } else if (val === 'AFTERNOON') {
                    setModalStartTime('13:00');
                    setModalEndTime('21:30');
                  } else if (val === 'OFFICE_HOURS') {
                    setModalStartTime('08:00');
                    setModalEndTime('17:30');
                  }
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              >
                <option value="OFFICE_HOURS">Ca Hành Chính (08:00 - 17:30)</option>
                <option value="MORNING">Ca Sáng (08:30 - 17:30)</option>
                <option value="AFTERNOON">Ca Chiều (13:00 - 21:30)</option>
                <option value="OFF">Nghỉ ca (OFF)</option>
              </select>
            </div>

            {modalShiftType !== 'OFF' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    required
                    value={modalStartTime}
                    onChange={e => setModalStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    required
                    value={modalEndTime}
                    onChange={e => setModalEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ghi chú phân ca / Địa điểm</label>
              <input
                type="text"
                placeholder="Ví dụ: Phòng Lab 02, Hỗ trợ sự kiện, OT 2h..."
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingShift(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md"
              >
                Lưu ca trực
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};