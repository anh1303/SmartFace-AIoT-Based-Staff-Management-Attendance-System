import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  CalendarRange,
  Clock,
  Users,
  CheckCircle2,
  Search,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Edit3,
  Calendar,
  Layers,
  Copy,
  Trash2,
  ChevronDown
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
  const [searchTerm, setSearchTerm] = useState('');
  const [editingShift, setEditingShift] = useState<{
    employeeId: string;
    employeeName: string;
    date: string;
    dayLabel: string;
    shift: WorkShift | undefined;
  } | null>(null);

  // Solar Calendar Week State (Default Monday of current week)
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));

  // Bulk Shift Assignment Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState<'ALL' | 'DEPARTMENT' | string>('ALL');
  const [bulkDepartment, setBulkDepartment] = useState('Nhân viên');
  const [bulkShiftType, setBulkShiftType] = useState<WorkShift['shift_type']>('OFFICE_HOURS');
  const [bulkStartTime, setBulkStartTime] = useState('08:00');
  const [bulkEndTime, setBulkEndTime] = useState('17:30');
  const [bulkDays, setBulkDays] = useState<number[]>([0, 1, 2, 3, 4]); // Mon-Fri default
  const [bulkNote, setBulkNote] = useState('');

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
      offset,
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

  const handleGoCurrentWeek = () => {
    setCurrentMonday(getMonday(new Date()));
    showToast('Đã chuyển về tuần làm việc hiện tại!', 'info');
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
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = e.full_name?.toLowerCase().includes(term);
      const matchId = e.employee_id?.toLowerCase().includes(term);
      const matchDept = e.department?.toLowerCase().includes(term);
      const matchPos = e.position?.toLowerCase().includes(term);
      if (!matchName && !matchId && !matchDept && !matchPos) return false;
    }
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

  // Bulk shift assignment submission
  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDays.length === 0) {
      showToast('Vui lòng chọn ít nhất 1 ngày trong tuần để áp dụng ca!', 'warning');
      return;
    }

    let targetEmps = employees.filter(e => e.status !== 'INACTIVE');
    if (bulkTarget === 'DEPARTMENT') {
      targetEmps = targetEmps.filter(e => e.department === bulkDepartment);
    } else if (bulkTarget !== 'ALL') {
      targetEmps = targetEmps.filter(e => e.employee_id === bulkTarget);
    }

    if (targetEmps.length === 0) {
      showToast('Không có nhân sự nào phù hợp với phạm vi đã chọn!', 'warning');
      return;
    }

    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];
    let count = 0;

    targetEmps.forEach(emp => {
      bulkDays.forEach(dayOffset => {
        const d = new Date(currentMonday);
        d.setDate(currentMonday.getDate() + dayOffset);
        const dateStr = formatDateToYYYYMMDD(d);
        const existing = workShifts.find(s => s.employee_id === emp.employee_id && s.date === dateStr);

        assignOrUpdateShift({
          shift_id: existing?.shift_id,
          employee_id: emp.employee_id,
          date: dateStr,
          work_day: dayNames[dayOffset],
          start_time: bulkShiftType === 'OFF' ? '00:00' : bulkStartTime,
          end_time: bulkShiftType === 'OFF' ? '00:00' : bulkEndTime,
          shift_type: bulkShiftType,
          department: emp.department || 'Nhân viên',
          note: bulkNote,
        });
        count++;
      });
    });

    setBulkModalOpen(false);
    showToast(`Đã phân ca hàng loạt thành công cho ${targetEmps.length} nhân sự (${count} ca trực)!`, 'success');
  };

  // Copy shifts from previous week
  const handleCopyPreviousWeek = () => {
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);
    const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật'];

    let copiedCount = 0;
    const activeEmps = employees.filter(e => e.status !== 'INACTIVE');

    activeEmps.forEach(emp => {
      [0, 1, 2, 3, 4, 5, 6].forEach(offset => {
        const prevDateObj = new Date(prevMonday);
        prevDateObj.setDate(prevMonday.getDate() + offset);
        const prevDateStr = formatDateToYYYYMMDD(prevDateObj);

        const currDateObj = new Date(currentMonday);
        currDateObj.setDate(currentMonday.getDate() + offset);
        const currDateStr = formatDateToYYYYMMDD(currDateObj);

        const prevShift = workShifts.find(s => s.employee_id === emp.employee_id && s.date === prevDateStr);
        const currShift = workShifts.find(s => s.employee_id === emp.employee_id && s.date === currDateStr);

        if (prevShift) {
          assignOrUpdateShift({
            shift_id: currShift?.shift_id,
            employee_id: emp.employee_id,
            date: currDateStr,
            work_day: dayNames[offset],
            start_time: prevShift.start_time,
            end_time: prevShift.end_time,
            shift_type: prevShift.shift_type,
            department: emp.department || 'Nhân viên',
            note: prevShift.note || 'Sao chép tuần trước',
          });
          copiedCount++;
        }
      });
    });

    if (copiedCount > 0) {
      showToast(`Đã sao chép thành công ${copiedCount} ca làm việc từ tuần trước!`, 'success');
    } else {
      showToast('Không tìm thấy dữ liệu ca làm việc ở tuần trước để sao chép!', 'warning');
    }
  };

  const renderShiftBadge = (shift: WorkShift | undefined) => {
    if (!shift || shift.shift_type === 'OFF') {
      return (
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#0b0d19] text-slate-400 dark:text-slate-500 text-xs text-center border border-slate-200/80 dark:border-[#21264b] group-hover:border-slate-300 dark:group-hover:border-purple-900/50 transition-colors">
          Nghỉ ca (OFF)
        </div>
      );
    }

    let colorClass = 'bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40';
    let typeName = 'Hành chính';

    if (shift.shift_type === 'MORNING') {
      colorClass = 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40';
      typeName = 'Ca Sáng';
    } else if (shift.shift_type === 'AFTERNOON') {
      colorClass = 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/40';
      typeName = 'Ca Chiều';
    }

    return (
      <div className={`p-2.5 rounded-xl border text-xs text-left transition-all shadow-xs ${colorClass}`}>
        <p className="font-bold tracking-tight">{typeName}</p>
        <p className="font-mono text-xs text-slate-700 dark:text-slate-200 mt-0.5">{shift.start_time} - {shift.end_time}</p>
        {shift.note && <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{shift.note}</p>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Thanh 1: Bento Header Banner with Continuous Shifting Gradient & Floating Blobs */}
      <div className="bento-hero-gradient rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
        {/* Ambient Floating & Morphing Blurred Blobs */}
        <div className="absolute -top-14 -right-10 w-72 h-72 bg-gradient-to-br from-purple-500/30 to-fuchsia-500/25 dark:from-purple-600/35 dark:to-fuchsia-600/25 rounded-full blur-3xl pointer-events-none animate-blob-1" />
        <div className="absolute -bottom-16 left-1/4 w-64 h-64 bg-gradient-to-tr from-indigo-500/30 to-blue-500/20 dark:from-indigo-600/30 dark:to-blue-600/20 rounded-full blur-3xl pointer-events-none animate-blob-2" />
        <div className="absolute top-1/4 right-1/3 w-48 h-48 bg-gradient-to-r from-violet-400/25 to-pink-400/25 dark:from-violet-500/25 dark:to-pink-500/20 rounded-full blur-2xl pointer-events-none animate-blob-3" />

        <div className="relative z-10">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white font-heading tracking-tight">
            Sắp Xếp & Phân Bổ Ca Làm Việc
          </h1>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          {/* Copy from previous week */}
          <button
            type="button"
            onClick={handleCopyPreviousWeek}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-[#272d5a] transition-colors shadow-xs cursor-pointer"
            title="Sao chép toàn bộ ca từ tuần trước sang tuần này"
          >
            <Copy className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Sao chép tuần trước</span>
          </button>

          {/* Bulk Assign Button */}
          <button
            type="button"
            onClick={() => setBulkModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-purple-500/20 transition-all cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>⚡ Phân ca nhanh hàng loạt</span>
          </button>
        </div>
      </div>

      {/* Thanh 2: Week Navigator & Filters Toolbar */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xs">
        {/* Week Selector + Today shortcut */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Solar Calendar Week Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] px-3 py-1.5 rounded-xl shadow-inner">
            <button
              type="button"
              onClick={handlePrevWeek}
              title="Tuần trước"
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex items-center gap-1.5 font-mono text-xs text-purple-600 dark:text-purple-400 font-semibold px-2 cursor-pointer group" title="Bấm để chọn tuần theo lịch dương">
              <CalendarRange className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
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
              className="p-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1a1e3a] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Shortcut Today Button */}
          <button
            type="button"
            onClick={handleGoCurrentWeek}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-[#272d5a] transition-colors cursor-pointer"
            title="Nhảy nhanh về tuần hiện tại"
          >
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Hôm nay</span>
          </button>
        </div>

        {/* Search & Position Filters */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search by Employee */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm tên, mã NV, chức vụ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Position / Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
              Chức vụ:
            </span>
            <div className="relative">
              <select
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
                className="bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl pl-3 pr-8 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 appearance-none cursor-pointer"
              >
                <option value="ALL" className="bg-white dark:bg-[#13162b]">Tất cả chức vụ</option>
                <option value="Bảo vệ" className="bg-white dark:bg-[#13162b]">Bảo vệ</option>
                <option value="Nhân viên" className="bg-white dark:bg-[#13162b]">Nhân viên</option>
                <option value="Thu ngân" className="bg-white dark:bg-[#13162b]">Thu ngân</option>
                <option value="Quản lý" className="bg-white dark:bg-[#13162b]">Quản lý</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Shift Matrix Grid */}
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-[#0f1224] border-b border-slate-200/80 dark:border-[#21264b] text-slate-500 dark:text-slate-400 font-mono text-[11px]">
              <tr>
                <th className="py-4 px-4 w-56 sticky left-0 bg-slate-50 dark:bg-[#0f1224] z-10 border-r border-slate-200/80 dark:border-[#21264b]">
                  Nhân sự ({filteredEmployees.length})
                </th>
                {daysOfWeek.map(d => (
                  <th key={d.date} className="py-4 px-3 min-w-[145px] border-r border-slate-200/60 dark:border-[#21264b]/60 last:border-r-0">
                    <div className="font-bold text-slate-900 dark:text-white text-xs">{d.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{d.label}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1d2243] text-slate-700 dark:text-slate-300">
              {filteredEmployees.map(emp => {
                const isInactive = emp.status === 'INACTIVE';
                return (
                  <tr key={emp.employee_id} className={`transition-colors ${isInactive ? 'bg-slate-50/50 dark:bg-[#0b0d19]/40 opacity-70' : 'hover:bg-slate-50/80 dark:hover:bg-[#1a1e3a]/40'}`}>
                    {/* Employee Fixed Column */}
                    <td className="py-3.5 px-4 sticky left-0 bg-white dark:bg-[#13162b] z-10 border-r border-slate-200/80 dark:border-[#21264b]">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={emp.avatar}
                          alt={emp.full_name}
                          className={`w-8 h-8 rounded-full object-cover border shrink-0 ${isInactive ? 'border-amber-500/50 grayscale' : 'border-slate-200 dark:border-slate-700'}`}
                        />
                        <div className="overflow-hidden">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-900 dark:text-white truncate text-xs">{emp.full_name}</p>
                            {isInactive && (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-50 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 shrink-0">
                                TẠM NGƯNG
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400 truncate">{emp.employee_id} • {emp.department}</p>
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
                          className={`py-2.5 px-2 border-r border-slate-100 dark:border-[#21264b]/60 last:border-r-0 ${isInactive ? 'cursor-not-allowed opacity-60' : 'cursor-pointer group hover:bg-purple-50/50 dark:hover:bg-purple-950/20'} transition-colors`}
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
      <div className="p-4 rounded-2xl bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400 shadow-xs">
        <div className="flex items-center gap-4">
          <span className="text-slate-900 dark:text-white font-semibold">Chú thích loại ca:</span>
          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-300">
            <span className="w-2.5 h-2.5 rounded bg-blue-500" /> Ca Sáng (08:30 - 17:30)
          </span>
          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <span className="w-2.5 h-2.5 rounded bg-purple-500" /> Hành Chính (08:00 - 17:30)
          </span>
          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-300">
            <span className="w-2.5 h-2.5 rounded bg-indigo-500" /> Ca Chiều (13:00 - 21:30)
          </span>
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-2.5 h-2.5 rounded bg-slate-300 dark:bg-slate-700" /> Nghỉ ca (OFF)
          </span>
        </div>
        <span className="text-purple-600 dark:text-purple-400 font-mono text-[11px]">Bấm vào ô để sửa hoặc phân bổ ca</span>
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại ca làm việc</label>
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="OFFICE_HOURS" className="bg-white dark:bg-[#13162b]">Ca Hành Chính (08:00 - 17:30)</option>
                <option value="MORNING" className="bg-white dark:bg-[#13162b]">Ca Sáng (08:30 - 17:30)</option>
                <option value="AFTERNOON" className="bg-white dark:bg-[#13162b]">Ca Chiều (13:00 - 21:30)</option>
                <option value="OFF" className="bg-white dark:bg-[#13162b]">Nghỉ ca (OFF)</option>
              </select>
            </div>

            {modalShiftType !== 'OFF' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Giờ bắt đầu</label>
                  <input
                    type="time"
                    required
                    value={modalStartTime}
                    onChange={e => setModalStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Giờ kết thúc</label>
                  <input
                    type="time"
                    required
                    value={modalEndTime}
                    onChange={e => setModalEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ghi chú phân ca / Địa điểm</label>
              <input
                type="text"
                placeholder="Ví dụ: Phòng Lab 02, Hỗ trợ sự kiện, OT 2h..."
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-slate-200 dark:border-[#21264b]">
              <button
                type="button"
                onClick={() => {
                  setModalShiftType('OFF');
                }}
                className="px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-1 border border-rose-200 dark:border-rose-500/20 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Đặt Nghỉ ca (OFF)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingShift(null)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 cursor-pointer"
                >
                  Lưu ca trực
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Bulk Shift Assignment Modal */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title="⚡ Phân ca nhanh hàng loạt"
        subtitle={`Áp dụng cho Tuần ${weekNumber} (${startLabel} - ${endLabel})`}
        maxWidth="lg"
      >
        <form onSubmit={handleBulkSubmit} className="space-y-4">
          {/* Target Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Đối tượng áp dụng</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBulkTarget('ALL')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${bulkTarget === 'ALL'
                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-600'
                  : 'bg-slate-50 dark:bg-[#0f1224] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#272d5a] hover:border-purple-300'
                  }`}
              >
                Tất cả nhân sự ({employees.filter(e => e.status !== 'INACTIVE').length})
              </button>

              <button
                type="button"
                onClick={() => setBulkTarget('DEPARTMENT')}
                className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${bulkTarget === 'DEPARTMENT'
                  ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-300 dark:border-purple-600'
                  : 'bg-slate-50 dark:bg-[#0f1224] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#272d5a] hover:border-purple-300'
                  }`}
              >
                Theo chức vụ
              </button>

              <select
                value={bulkTarget !== 'ALL' && bulkTarget !== 'DEPARTMENT' ? bulkTarget : ''}
                onChange={e => setBulkTarget(e.target.value)}
                className="py-2 px-3 rounded-xl text-xs font-semibold border transition-all bg-slate-50 dark:bg-[#0f1224] text-slate-900 dark:text-slate-200 border-slate-200 dark:border-[#272d5a] focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="" className="bg-white dark:bg-[#13162b]">Chọn từng NV...</option>
                {employees.filter(e => e.status !== 'INACTIVE').map(e => (
                  <option key={e.employee_id} value={e.employee_id} className="bg-white dark:bg-[#13162b]">
                    {e.full_name} ({e.employee_id})
                  </option>
                ))}
              </select>
            </div>

            {bulkTarget === 'DEPARTMENT' && (
              <div className="mt-2.5">
                <select
                  value={bulkDepartment}
                  onChange={e => setBulkDepartment(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="Bảo vệ" className="bg-white dark:bg-[#13162b]">Bảo vệ</option>
                  <option value="Nhân viên" className="bg-white dark:bg-[#13162b]">Nhân viên</option>
                  <option value="Thu ngân" className="bg-white dark:bg-[#13162b]">Thu ngân</option>
                  <option value="Quản lý" className="bg-white dark:bg-[#13162b]">Quản lý</option>
                </select>
              </div>
            )}
          </div>

          {/* Shift Type Selection */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại ca làm việc</label>
              <select
                value={bulkShiftType}
                onChange={e => {
                  const val = e.target.value as WorkShift['shift_type'];
                  setBulkShiftType(val);
                  if (val === 'MORNING') {
                    setBulkStartTime('08:30');
                    setBulkEndTime('17:30');
                  } else if (val === 'AFTERNOON') {
                    setBulkStartTime('13:00');
                    setBulkEndTime('21:30');
                  } else if (val === 'OFFICE_HOURS') {
                    setBulkStartTime('08:00');
                    setBulkEndTime('17:30');
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
              >
                <option value="OFFICE_HOURS" className="bg-white dark:bg-[#13162b]">Ca Hành Chính (08:00 - 17:30)</option>
                <option value="MORNING" className="bg-white dark:bg-[#13162b]">Ca Sáng (08:30 - 17:30)</option>
                <option value="AFTERNOON" className="bg-white dark:bg-[#13162b]">Ca Chiều (13:00 - 21:30)</option>
                <option value="OFF" className="bg-white dark:bg-[#13162b]">Nghỉ ca (OFF)</option>
              </select>
            </div>

            {bulkShiftType !== 'OFF' ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Bắt đầu</label>
                  <input
                    type="time"
                    value={bulkStartTime}
                    onChange={e => setBulkStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Kết thúc</label>
                  <input
                    type="time"
                    value={bulkEndTime}
                    onChange={e => setBulkEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center text-xs text-slate-500 italic pt-6">
                Đặt trạng thái nghỉ không tính giờ làm.
              </div>
            )}
          </div>

          {/* Days Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Các ngày áp dụng trong tuần</label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setBulkDays([0, 1, 2, 3, 4])}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] text-purple-600 dark:text-purple-400 hover:bg-slate-200 dark:hover:bg-[#1a1e3a] cursor-pointer"
                >
                  T2 - T6
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDays([0, 1, 2, 3, 4, 5])}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] text-purple-600 dark:text-purple-400 hover:bg-slate-200 dark:hover:bg-[#1a1e3a] cursor-pointer"
                >
                  T2 - T7
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDays([0, 1, 2, 3, 4, 5, 6])}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] text-purple-600 dark:text-purple-400 hover:bg-slate-200 dark:hover:bg-[#1a1e3a] cursor-pointer"
                >
                  Cả tuần
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dName, idx) => {
                const isSelected = bulkDays.includes(idx);
                return (
                  <button
                    key={dName}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setBulkDays(bulkDays.filter(d => d !== idx));
                      } else {
                        setBulkDays([...bulkDays, idx].sort());
                      }
                    }}
                    className={`py-2 text-center rounded-xl text-xs font-bold border transition-all cursor-pointer ${isSelected
                      ? 'bg-purple-600 text-white border-purple-500 shadow-xs shadow-purple-500/20'
                      : 'bg-slate-50 dark:bg-[#0f1224] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#272d5a] hover:border-purple-300'
                      }`}
                  >
                    {dName}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ghi chú phân ca</label>
            <input
              type="text"
              placeholder="Ví dụ: Phân ca chuẩn tháng 10, Ca trực tuần..."
              value={bulkNote}
              onChange={e => setBulkNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-200 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => setBulkModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm shadow-purple-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Áp dụng phân ca ngay</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};