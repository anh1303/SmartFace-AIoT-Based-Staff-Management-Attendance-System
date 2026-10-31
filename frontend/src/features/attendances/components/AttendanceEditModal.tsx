import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { formatSecondsToHHMMSS, roundPayableHours, roundToHalfHour } from '../../../utils/timeUtils';

export interface EditingItemState {
  employee: AttendancePairItem['employee'];
  shiftName: string;
  shiftTimeRange: string;
  start_time: string;
  end_time: string;
  inTime: string;
  outTime: string;
  initialOTSec: number | null;
  currentOTSec: number;
  initialLateEarlySec: number | null;
  currentLateEarlySec: number;
  date: string;
  isOffDay?: boolean;
}

interface AttendanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: EditingItemState | null;
  onSave: (payload: {
    employeeId: string;
    date: string;
    late_early: number;
    overtime: number;
    reason: string;
  }) => Promise<void>;
}

export const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  onSave,
}) => {
  const [inputLEHours, setInputLEHours] = useState<number | ''>(0);
  const [inputLEMinutes, setInputLEMinutes] = useState<number | ''>(0);
  const [inputLESeconds, setInputLESeconds] = useState<number | ''>(0);

  const [inputOTHours, setInputOTHours] = useState<number | ''>(0);
  const [inputOTMinutes, setInputOTMinutes] = useState<number | ''>(0);
  const [inputOTSeconds, setInputOTSeconds] = useState<number | ''>(0);

  const [reason, setReason] = useState<string>('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (editingItem) {
      const leH = Math.floor(editingItem.currentLateEarlySec / 3600);
      const leM = Math.floor((editingItem.currentLateEarlySec % 3600) / 60);
      const leS = editingItem.currentLateEarlySec % 60;
      setInputLEHours(leH);
      setInputLEMinutes(leM);
      setInputLESeconds(leS);

      const otH = Math.floor(editingItem.currentOTSec / 3600);
      const otM = Math.floor((editingItem.currentOTSec % 3600) / 60);
      const otS = editingItem.currentOTSec % 60;
      setInputOTHours(otH);
      setInputOTMinutes(otM);
      setInputOTSeconds(otS);

      setReason('');
      setModalError(null);
      setIsSubmitting(false);
    }
  }, [editingItem]);

  if (!isOpen || !editingItem) return null;

  const validateInputs = (
    leH: number,
    leM: number,
    leS: number,
    _otH: number,
    _otM: number,
    _otS: number,
    currentReason: string
  ) => {
    const totalLE = (leH || 0) * 3600 + (leM || 0) * 60 + (leS || 0);

    if (![leH, leM, leS, _otH, _otM, _otS].every(Number.isFinite) || totalLE < 0 || leH < 0 || _otH < 0 || leM < 0 || leM > 59 || _otM < 0 || _otM > 59 || leS < 0 || leS > 59 || _otS < 0 || _otS > 59) {
      setModalError('Nhập thời gian hợp lệ, không âm; phút/giây từ 0–59.');
      return false;
    }

    if (editingItem.initialLateEarlySec != null && totalLE > editingItem.initialLateEarlySec && editingItem.initialLateEarlySec > 0) {
      setModalError(`Thời gian đi trễ/về sớm không được vượt quá thời gian trễ/sớm thực tế (${formatSecondsToHHMMSS(editingItem.initialLateEarlySec)})`);
      return false;
    }

    // BỎ GIỚI HẠN: OT không bị chặn bởi initialOTSec để quản lý tự do điều chỉnh/duyệt OT kể cả ngày OFF

    if (!currentReason.trim() || currentReason.trim().length < 3) {
      setModalError('Cần ghi lý do duyệt/điều chỉnh (ít nhất 3 ký tự).');
      return false;
    }

    setModalError(null);
    return true;
  };

  const handleLEChange = (h: number | '', m: number | '', s: number | '') => {
    setInputLEHours(h);
    setInputLEMinutes(m);
    setInputLESeconds(s);
  };

  const handleOTChange = (h: number | '', m: number | '', s: number | '') => {
    setInputOTHours(h);
    setInputOTMinutes(m);
    setInputOTSeconds(s);
  };

  const handleSave = async () => {
    const totalInputLESec = (inputLEHours || 0) * 3600 + (inputLEMinutes || 0) * 60 + (inputLESeconds || 0);
    const totalInputOTSec = (inputOTHours || 0) * 3600 + (inputOTMinutes || 0) * 60 + (inputOTSeconds || 0);

    if (!validateInputs(inputLEHours || 0, inputLEMinutes || 0, inputLESeconds || 0, inputOTHours || 0, inputOTMinutes || 0, inputOTSeconds || 0, reason)) {
      return;
    }

    const roundedLEHours = roundPayableHours(totalInputLESec);
    const roundedOTHours = roundPayableHours(totalInputOTSec);

    setIsSubmitting(true);
    setModalError(null);

    try {
      await onSave({
        employeeId: editingItem.employee.employee_id,
        date: editingItem.date,
        late_early: roundedLEHours,
        overtime: roundedOTHours,
        reason: reason.trim(),
      });
      // Chỉ đóng modal sau khi API hoàn tất thành công
      onClose();
    } catch (err: unknown) {
      // Khi API lỗi, giữ form lại để người dùng sửa đổi
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi lưu điều chỉnh';
      setModalError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalNode = (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#13162b] border border-slate-200/80 dark:border-[#21264b] rounded-xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 dark:border-[#21264b] flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white font-heading">
              Điều Chỉnh Thời Gian Chấm Công
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {editingItem.employee.full_name} · {editingItem.employee.employee_id}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1d2243] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="sf-field">Ngày làm việc<input className="sf-input font-semibold" value={editingItem.date.split('-').reverse().join('/')} readOnly /></label>
            <label className="sf-field">Ca làm việc<input className="sf-input font-semibold" value={editingItem.shiftName} readOnly /></label>
            <label className="sf-field">Giờ làm việc<input className="sf-input font-semibold" value={editingItem.shiftTimeRange} readOnly /></label>
            <label className="sf-field">Vào ca – Tan ca<input className="sf-input font-semibold" value={`${editingItem.inTime} – ${editingItem.outTime}`} readOnly /></label>
          </div>

          {editingItem.isOffDay && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] leading-relaxed">
              ℹ️ <strong>Ngày nghỉ (OFF):</strong> Nhân viên không có giờ công tiêu chuẩn. Quản lý có thể nhập và phê duyệt giờ tăng ca (OT) làm thêm cho ngày này.
            </div>
          )}

          {modalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{modalError}</span>
            </div>
          )}

          {/* Input 1: Late / Early (Chỉ áp dụng nếu không phải ngày OFF) */}
          {!editingItem.isOffDay && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                  Thời gian Đi trễ / Về sớm
                </label>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Thực tế: <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">{editingItem.initialLateEarlySec == null ? '—' : formatSecondsToHHMMSS(editingItem.initialLateEarlySec)}</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Giờ</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={inputLEHours}
                    disabled={isSubmitting}
                    onChange={(e) => handleLEChange(e.target.value === '' ? '' : Number(e.target.value), inputLEMinutes, inputLESeconds)}
                    className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Phút</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={inputLEMinutes}
                    disabled={isSubmitting}
                    onChange={(e) => handleLEChange(inputLEHours, e.target.value === '' ? '' : Number(e.target.value), inputLESeconds)}
                    className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Giây</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={inputLESeconds}
                    disabled={isSubmitting}
                    onChange={(e) => handleLEChange(inputLEHours, inputLEMinutes, e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Input 2: Overtime */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                Thời gian Tăng ca (OT)
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Thực tế: <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{editingItem.initialOTSec == null ? '—' : formatSecondsToHHMMSS(editingItem.initialOTSec)}</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Giờ</span>
                <input
                  type="number"
                  min={0}
                  max={744}
                  value={inputOTHours}
                  disabled={isSubmitting}
                  onChange={(e) => handleOTChange(e.target.value === '' ? '' : Number(e.target.value), inputOTMinutes, inputOTSeconds)}
                  className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Phút</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inputOTMinutes}
                  disabled={isSubmitting}
                  onChange={(e) => handleOTChange(inputOTHours, e.target.value === '' ? '' : Number(e.target.value), inputOTSeconds)}
                  className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1">Giây</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inputOTSeconds}
                  disabled={isSubmitting}
                  onChange={(e) => handleOTChange(inputOTHours, inputOTMinutes, e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-center font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </div>

          {/* Input 3: Lý do điều chỉnh (Bắt buộc) */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-900 dark:text-white flex items-center justify-between">
              <span>Lý do điều chỉnh <span className="text-rose-500 font-bold">*</span></span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Bắt buộc giải trình</span>
            </label>
            <textarea
              value={reason}
              disabled={isSubmitting}
              onChange={(e) => {
                setReason(e.target.value);
                if (modalError) setModalError(null);
              }}
              rows={2}
              placeholder="Nhập lý do điều chỉnh (ví dụ: Phê duyệt OT ngày nghỉ, điều chỉnh giờ công theo đề xuất quản lý...)"
              className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none placeholder:text-slate-400"
            />
          </div>

        </div>

        <div className="p-6 border-t border-slate-100 dark:border-[#21264b] flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-[#0f1224] hover:bg-slate-200 dark:hover:bg-[#1d2243] transition-colors cursor-pointer disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all cursor-pointer shadow-sm shadow-blue-600/20 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Đang lưu...' : 'Lưu thay đổi'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
