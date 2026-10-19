import React from 'react';
import { Trash2, Lock } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { WorkShift } from '../../../types';

export interface EditingShiftTarget {
  employeeId: string;
  employeeName: string;
  date: string;
  dayLabel: string;
  shift: WorkShift | undefined;
}

interface ShiftEditModalProps {
  editingShift: EditingShiftTarget | null;
  onClose: () => void;
  shiftType: WorkShift['shift_type'];
  setShiftType: (type: WorkShift['shift_type']) => void;
  startTime: string;
  setStartTime: (time: string) => void;
  endTime: string;
  setEndTime: (time: string) => void;
  note: string;
  setNote: (note: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const ShiftEditModal: React.FC<ShiftEditModalProps> = ({
  editingShift,
  onClose,
  shiftType,
  setShiftType,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  note,
  setNote,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={Boolean(editingShift)}
      onClose={onClose}
      title={`Phân bổ ca trực: ${editingShift?.employeeName}`}
      subtitle={`Ngày làm việc: ${editingShift?.dayLabel}`}
      maxWidth="md"
    >
      {editingShift && (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Loại ca làm việc</label>
            <select
              value={shiftType}
              onChange={e => {
                const val = e.target.value as WorkShift['shift_type'];
                setShiftType(val);
                if (val === 'MORNING') {
                  setStartTime('08:30');
                  setEndTime('17:30');
                } else if (val === 'AFTERNOON') {
                  setStartTime('13:00');
                  setEndTime('21:30');
                } else if (val === 'OFFICE_HOURS') {
                  setStartTime('08:00');
                  setEndTime('17:30');
                } else if (val === 'OFF') {
                  setStartTime('00:00');
                  setEndTime('00:00');
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

          {shiftType !== 'OFF' ? (
            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Khung giờ làm việc cố định:
                </span>
                <span className="px-2.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-mono font-bold">
                  {startTime} - {endTime}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                <span>Giờ bắt đầu và kết thúc là mặc định theo quy định doanh nghiệp và không thể chỉnh sửa.</span>
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] text-xs text-slate-500 dark:text-slate-400 italic">
              Nghỉ ca (OFF): Không tính giờ làm việc trong ngày.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ghi chú phân ca / Địa điểm</label>
            <input
              type="text"
              placeholder="Ví dụ: Phòng Lab 02, Hỗ trợ sự kiện, OT 2h..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-slate-200 dark:border-[#21264b]">
            <button
              type="button"
              onClick={() => {
                setShiftType('OFF');
              }}
              className="px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-1 border border-rose-200 dark:border-rose-500/20 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Đặt Nghỉ ca (OFF)</span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
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
  );
};
