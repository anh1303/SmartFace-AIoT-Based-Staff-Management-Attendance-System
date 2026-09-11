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

export const ManagerSchedule: React.FC = () => {
  const { employees, workShifts, assignOrUpdateShift } = useApp();
  const [departmentFilter, setDepartmentFilter] = useState('ALL');
  const [editingShift, setEditingShift] = useState<{
    employeeId: string;
    employeeName: string;
    date: string;
    dayLabel: string;
    shift: WorkShift | undefined;
  } | null>(null);

  // Form state inside modal
  const [modalShiftType, setModalShiftType] = useState<WorkShift['shift_type']>('OFFICE_HOURS');
  const [modalStartTime, setModalStartTime] = useState('08:00');
  const [modalEndTime, setModalEndTime] = useState('17:30');
  const [modalNote, setModalNote] = useState('');

  const daysOfWeek = [
    { name: 'Thứ 2', date: '2026-09-07', label: '07/09' },
    { name: 'Thứ 3', date: '2026-09-08', label: '08/09' },
    { name: 'Thứ 4', date: '2026-09-09', label: '09/09' },
    { name: 'Thứ 5', date: '2026-09-10', label: '10/09' },
    { name: 'Thứ 6', date: '2026-09-11', label: '11/09' },
    { name: 'Thứ 7', date: '2026-09-12', label: '12/09' },
    { name: 'Chủ Nhật', date: '2026-09-13', label: '13/09' },
  ];

  const filteredEmployees = employees.filter(e => {
    if (departmentFilter !== 'ALL' && e.department !== departmentFilter) return false;
    return true;
  });

  const handleCellClick = (empId: string, empName: string, date: string, dayLabel: string) => {
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

    assignOrUpdateShift({
      shift_id: editingShift.shift?.shift_id,
      employee_id: editingShift.employeeId,
      date: editingShift.date,
      start_time: modalShiftType === 'OFF' ? '00:00' : modalStartTime,
      end_time: modalShiftType === 'OFF' ? '00:00' : modalEndTime,
      shift_type: modalShiftType,
      department: emp?.department || 'Kỹ thuật AI',
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
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-mono font-medium border border-blue-500/20">
              TUẦN 37 (07/09 - 13/09)
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Bấm vào bất kỳ ô ca trực nào để phân bổ hoặc điều chỉnh giờ làm cho nhân viên.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span>Phòng ban:</span>
          </div>
          <select
            value={departmentFilter}
            onChange={e => setDepartmentFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">Tất cả phòng ban</option>
            <option value="Kỹ thuật AI">Kỹ thuật AI</option>
            <option value="Vận hành & IT">Vận hành & IT</option>
            <option value="Nhân sự & HR">Nhân sự & HR</option>
            <option value="Kinh doanh & Dự án">Kinh doanh & Dự án</option>
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
              {filteredEmployees.map(emp => (
                <tr key={emp.employee_id} className="hover:bg-slate-800/30 transition-colors">
                  {/* Employee Fixed Column */}
                  <td className="py-3 px-4 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={emp.avatar}
                        alt={emp.full_name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-700 shrink-0"
                      />
                      <div className="overflow-hidden">
                        <p className="font-semibold text-white truncate">{emp.full_name}</p>
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
                        className="py-2.5 px-2 border-r border-slate-800/60 last:border-r-0 cursor-pointer group hover:bg-blue-600/10 transition-colors"
                      >
                        {renderShiftBadge(shift)}
                      </td>
                    );
                  })}
                </tr>
              ))}
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
