import React from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { WorkShift, Employee } from '../../../types';

interface BulkShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekNumber: number;
  startLabel: string;
  endLabel: string;
  employees: Employee[];
  bulkTarget: 'ALL' | 'DEPARTMENT' | string;
  setBulkTarget: (target: 'ALL' | 'DEPARTMENT' | string) => void;
  bulkDepartment: string;
  setBulkDepartment: (dept: string) => void;
  bulkShiftType: WorkShift['shift_type'];
  setBulkShiftType: (type: WorkShift['shift_type']) => void;
  bulkStartTime: string;
  setBulkStartTime: (t: string) => void;
  bulkEndTime: string;
  setBulkEndTime: (t: string) => void;
  bulkDays: number[];
  setBulkDays: (days: number[]) => void;
  bulkNote: string;
  setBulkNote: (note: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const BulkShiftModal: React.FC<BulkShiftModalProps> = ({
  isOpen,
  onClose,
  weekNumber,
  startLabel,
  endLabel,
  employees,
  bulkTarget,
  setBulkTarget,
  bulkDepartment,
  setBulkDepartment,
  bulkShiftType,
  setBulkShiftType,
  bulkStartTime,
  setBulkStartTime,
  bulkEndTime,
  setBulkEndTime,
  bulkDays,
  setBulkDays,
  bulkNote,
  setBulkNote,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="⚡ Phân ca nhanh hàng loạt"
      subtitle={`Áp dụng cho Tuần ${weekNumber} (${startLabel} - ${endLabel})`}
      maxWidth="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4">
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
            onClick={onClose}
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
  );
};
