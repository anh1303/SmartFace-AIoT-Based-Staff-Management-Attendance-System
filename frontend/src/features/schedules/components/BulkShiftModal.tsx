import {ShiftTemplatePicker,templateAssignment} from './ShiftTemplates';
import React from 'react';
import { Sparkles } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { WorkShift, Employee, DepartmentItem } from '../../../types';
import { ShiftTimeInput } from './ShiftTimeInput';

interface BulkShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  weekNumber: number;
  startLabel: string;
  endLabel: string;
  employees: Employee[];
  departments?: DepartmentItem[] | string[];
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
  isSubmitting?: boolean;
  error?: string;
}

export const BulkShiftModal: React.FC<BulkShiftModalProps> = ({
  isOpen,
  onClose,
  weekNumber,
  startLabel,
  endLabel,
  employees,
  departments = [],
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
  isSubmitting=false,
  error,
}) => {
  const departmentList = React.useMemo(() => {
    if (departments && departments.length > 0) {
      return departments.map(d => (typeof d === 'string' ? d : d.name));
    }
    const deptSet = new Set<string>();
    employees.forEach(e => {
      if (e.department) deptSet.add(e.department);
    });
    return Array.from(deptSet);
  }, [departments, employees]);
  const isTimeInvalid = bulkShiftType === 'OTHER' && bulkStartTime >= bulkEndTime;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Phân ca nhanh hàng loạt"
      subtitle={`Áp dụng cho Tuần ${weekNumber} (${startLabel} - ${endLabel})`}
      maxWidth="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4"><fieldset disabled={isSubmitting} className="space-y-4"><ShiftTemplatePicker onApply={template=>{const value=templateAssignment(template);setBulkShiftType(value.shift_type);setBulkStartTime(value.start_time);setBulkEndTime(value.end_time);setBulkNote(value.note);}}/>
        {/* Target Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Đối tượng áp dụng</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setBulkTarget('ALL')}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${bulkTarget === 'ALL'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600'
                : 'bg-slate-50 dark:bg-[#0f1224] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#272d5a] hover:border-blue-300'
                }`}
            >
              Tất cả nhân sự ({employees.filter(e => e.status !== 'INACTIVE').length})
            </button>

            <button
              type="button"
              onClick={() => {
                setBulkTarget('DEPARTMENT');
                if (!bulkDepartment && departmentList.length > 0) {
                  setBulkDepartment(departmentList[0]);
                }
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${bulkTarget === 'DEPARTMENT'
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600'
                : 'bg-slate-50 dark:bg-[#0f1224] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#272d5a] hover:border-blue-300'
                }`}
            >
              Theo phòng ban
            </button>

            <select
              aria-label="Đối tượng áp dụng"
              value={bulkTarget !== 'ALL' && bulkTarget !== 'DEPARTMENT' ? bulkTarget : ''}
              onChange={e => setBulkTarget(e.target.value)}
              className="py-2 px-3 rounded-xl text-xs font-semibold border transition-all bg-slate-50 dark:bg-[#0f1224] text-slate-900 dark:text-slate-200 border-slate-200 dark:border-[#272d5a] focus:outline-none focus:border-blue-500 cursor-pointer"
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              >
                {departmentList.length === 0 ? (
                  <option value="" disabled className="bg-white dark:bg-[#13162b]">Chưa có phòng ban nào</option>
                ) : (
                  departmentList.map(deptName => (
                    <option key={deptName} value={deptName} className="bg-white dark:bg-[#13162b]">
                      {deptName}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>

        {/* Shift Type Selection */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ca làm việc</label>
            <select
              aria-label="Ca làm việc"
              value={bulkShiftType}
              onChange={e => {
                const val = e.target.value as WorkShift['shift_type'];
                setBulkShiftType(val);
                if (val === 'MORNING') {
                  setBulkStartTime('08:00');
                  setBulkEndTime('12:00');
                } else if (val === 'AFTERNOON') {
                  setBulkStartTime('13:00');
                  setBulkEndTime('17:00');
                } else if (val === 'OFFICE_HOURS') {
                  setBulkStartTime('08:00');
                  setBulkEndTime('17:00');
                } else if (val === 'OTHER') {
                  setBulkStartTime('00:00');
                  setBulkEndTime('00:00');
                } else if (val === 'OFF') {
                  setBulkStartTime('00:00');
                  setBulkEndTime('00:00');
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
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Bắt đầu
                </label>
                <ShiftTimeInput
                  id="bulk-shift-start"
                  value={bulkStartTime}
                  onChange={setBulkStartTime}
                  disabled={bulkShiftType !== 'OTHER'}
                  hasError={isTimeInvalid && (bulkStartTime !== '00:00' || bulkEndTime !== '00:00')}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Kết thúc
                </label>
                <ShiftTimeInput
                  id="bulk-shift-end"
                  value={bulkEndTime}
                  onChange={setBulkEndTime}
                  disabled={bulkShiftType !== 'OTHER'}
                  hasError={isTimeInvalid && (bulkStartTime !== '00:00' || bulkEndTime !== '00:00')}
                />
              </div>
            </div>
            {isTimeInvalid && (bulkStartTime !== '00:00' || bulkEndTime !== '00:00') && (
              <p className="text-[11px] text-rose-500 dark:text-rose-400 font-medium">
                ⚠️ Giờ bắt đầu phải nhỏ hơn giờ kết thúc.
              </p>
            )}
          </div>
        </div>

        {/* Days Selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Các ngày áp dụng trong tuần</label>
            <div className="flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setBulkDays([0, 1, 2, 3, 4])}
                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] text-blue-600 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-[#1a1e3a] cursor-pointer"
              >
                T2 - T6
              </button>
              <button
                type="button"
                onClick={() => setBulkDays([0, 1, 2, 3, 4, 5])}
                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] text-blue-600 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-[#1a1e3a] cursor-pointer"
              >
                T2 - T7
              </button>
              <button
                type="button"
                onClick={() => setBulkDays([0, 1, 2, 3, 4, 5, 6])}
                className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-[#0f1224] text-blue-600 dark:text-blue-400 hover:bg-slate-200 dark:hover:bg-[#1a1e3a] cursor-pointer"
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
                    ? 'bg-blue-600 text-white border-blue-500 shadow-xs shadow-blue-500/20'
                    : 'bg-slate-50 dark:bg-[#0f1224] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-[#272d5a] hover:border-blue-300'
                    }`}
                >
                  {dName}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ghi chú</label>
          <input
            type="text"
            placeholder="Ví dụ: Phân ca chuẩn tháng 10, Ca trực tuần..."
            value={bulkNote}
            onChange={e => setBulkNote(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {error&&<div className="sf-feedback error" role="alert">{error}</div>}
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
            disabled={isTimeInvalid}
            className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-all ${
              isTimeInvalid
                ? 'bg-slate-400 dark:bg-slate-700 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20 cursor-pointer'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Áp dụng phân ca ngay</span>
          </button>
        </div>
      </fieldset></form>
    </Modal>
  );
};
