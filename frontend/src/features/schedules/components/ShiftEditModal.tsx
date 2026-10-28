import {ShiftTemplatePicker,templateAssignment} from './ShiftTemplates';
import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { WorkShift } from '../../../types';
import { ShiftTimeInput } from './ShiftTimeInput';

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
  isSubmitting?: boolean;
  error?: string;
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
  isSubmitting=false,
  error,
}) => {
  const isTimeInvalid = shiftType === 'OTHER' && startTime >= endTime;

  return (
    <Modal
      isOpen={Boolean(editingShift)}
      onClose={onClose}
      title={`Phân bổ ca trực: ${editingShift?.employeeName}`}
      subtitle={`Ngày làm việc: ${editingShift?.dayLabel}`}
      maxWidth="md"
    >
      {editingShift && (
        <form onSubmit={onSubmit} className="space-y-4"><fieldset disabled={isSubmitting} className="space-y-4"><ShiftTemplatePicker onApply={template=>{const value=templateAssignment(template);setShiftType(value.shift_type);setStartTime(value.start_time);setEndTime(value.end_time);setNote(value.note);}}/>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ca làm việc</label>
            <select
              aria-label="Ca làm việc"
              value={shiftType}
              onChange={e => {
                const val = e.target.value as WorkShift['shift_type'];
                setShiftType(val);
                if (val === 'MORNING') {
                  setStartTime('08:00');
                  setEndTime('12:00');
                } else if (val === 'AFTERNOON') {
                  setStartTime('13:00');
                  setEndTime('17:00');
                } else if (val === 'OFFICE_HOURS') {
                  setStartTime('08:00');
                  setEndTime('17:00');
                } else if (val === 'OTHER') {
                  setStartTime('00:00');
                  setEndTime('00:00');
                } else if (val === 'OFF') {
                  setStartTime('00:00');
                  setEndTime('00:00');
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            >
              <option value="OFFICE_HOURS" className="bg-white dark:bg-[#13162b]">Ca Hành Chính</option>
              <option value="MORNING" className="bg-white dark:bg-[#13162b]">Ca Sáng</option>
              <option value="AFTERNOON" className="bg-white dark:bg-[#13162b]">Ca Chiều</option>
              <option value="OTHER" className="bg-white dark:bg-[#13162b]">Ca khác</option>
              <option value="OFF" className="bg-white dark:bg-[#13162b]">Nghỉ ca</option>
            </select>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 space-y-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Khung giờ làm việc:
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="modal-shift-start" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Giờ bắt đầu
                </label>
                <ShiftTimeInput
                  id="modal-shift-start"
                  value={startTime}
                  onChange={setStartTime}
                  disabled={shiftType !== 'OTHER'}
                  hasError={isTimeInvalid && (startTime !== '00:00' || endTime !== '00:00')}
                />
              </div>
              <div>
                <label htmlFor="modal-shift-end" className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Giờ kết thúc
                </label>
                <ShiftTimeInput
                  id="modal-shift-end"
                  value={endTime}
                  onChange={setEndTime}
                  disabled={shiftType !== 'OTHER'}
                  hasError={isTimeInvalid && (startTime !== '00:00' || endTime !== '00:00')}
                />
              </div>
            </div>
            {isTimeInvalid && (startTime !== '00:00' || endTime !== '00:00') && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
                ⚠️ Giờ bắt đầu phải nhỏ hơn giờ kết thúc.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ghi chú</label>
            <input
              type="text"
              placeholder="Ví dụ: Phòng Lab 02, Hỗ trợ sự kiện, OT 2h..."
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {error&&<div className="sf-feedback error" role="alert">{error}</div>}
          <div className="pt-4 flex justify-end items-center gap-2 border-t border-slate-200 dark:border-[#21264b]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isTimeInvalid}
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${isTimeInvalid
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 cursor-pointer'
                }`}
            >
              Lưu
            </button>
          </div>
        </fieldset></form>
      )}
    </Modal>
  );
};
