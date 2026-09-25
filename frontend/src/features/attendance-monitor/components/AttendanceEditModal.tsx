import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, AlertTriangle } from 'lucide-react';
import { AttendancePairItem } from '../hooks/useAttendancePairs';
import { formatSecondsToHHMMSS, roundTo30Minutes } from '../timeUtils';

interface EditingItemState {
  employee: AttendancePairItem['employee'];
  shiftName: string;
  shiftTimeRange: string;
  start_time: string;
  end_time: string;
  inTime: string;
  outTime: string;
  initialOTSec: number;
  currentOTSec: number;
  initialLateEarlySec: number;
  currentLateEarlySec: number;
  date: string;
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
  }) => Promise<void>;
}

export const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({
  isOpen,
  onClose,
  editingItem,
  onSave,
}) => {
  const [inputLEHours, setInputLEHours] = useState<number>(0);
  const [inputLEMinutes, setInputLEMinutes] = useState<number>(0);
  const [inputLESeconds, setInputLESeconds] = useState<number>(0);

  const [inputOTHours, setInputOTHours] = useState<number>(0);
  const [inputOTMinutes, setInputOTMinutes] = useState<number>(0);
  const [inputOTSeconds, setInputOTSeconds] = useState<number>(0);

  const [modalError, setModalError] = useState<string | null>(null);

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

      setModalError(null);
    }
  }, [editingItem]);

  if (!isOpen || !editingItem) return null;

  const validateInputs = (
    leH: number,
    leM: number,
    leS: number,
    otH: number,
    otM: number,
    otS: number
  ) => {
    const totalLE = (leH || 0) * 3600 + (leM || 0) * 60 + (leS || 0);
    const totalOT = (otH || 0) * 3600 + (otM || 0) * 60 + (otS || 0);

    if (totalLE > editingItem.initialLateEarlySec) {
      setModalError(`Thời gian đi trễ/về sớm không được vượt quá thời gian trễ/sớm thực tế (${formatSecondsToHHMMSS(editingItem.initialLateEarlySec)})`);
      return false;
    }

    if (totalOT > editingItem.initialOTSec) {
      setModalError(`Thời gian tăng ca không được vượt quá thời gian tăng ca thực tế (${formatSecondsToHHMMSS(editingItem.initialOTSec)})`);
      return false;
    }

    setModalError(null);
    return true;
  };

  const handleLEChange = (h: number, m: number, s: number) => {
    setInputLEHours(h);
    setInputLEMinutes(m);
    setInputLESeconds(s);
    validateInputs(h, m, s, inputOTHours, inputOTMinutes, inputOTSeconds);
  };

  const handleOTChange = (h: number, m: number, s: number) => {
    setInputOTHours(h);
    setInputOTMinutes(m);
    setInputOTSeconds(s);
    validateInputs(inputLEHours, inputLEMinutes, inputLESeconds, h, m, s);
  };

  const handleSave = async () => {
    const totalInputLESec = (inputLEHours || 0) * 3600 + (inputLEMinutes || 0) * 60 + (inputLESeconds || 0);
    const totalInputOTSec = (inputOTHours || 0) * 3600 + (inputOTMinutes || 0) * 60 + (inputOTSeconds || 0);

    if (!validateInputs(inputLEHours, inputLEMinutes, inputLESeconds, inputOTHours, inputOTMinutes, inputOTSeconds)) {
      return;
    }

    const roundedLEHours = Math.round(totalInputLESec / 1800) * 0.5;
    const roundedOTHours = Math.round(totalInputOTSec / 1800) * 0.5;

    await onSave({
      employeeId: editingItem.employee.employee_id,
      date: editingItem.date,
      late_early: roundedLEHours,
      overtime: roundedOTHours,
    });
    onClose();
  };

  const modalNode = (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white font-heading">
              Điều Chỉnh Thời Gian Chấm Công
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Nhân viên: <span className="text-white font-semibold">{editingItem.employee.full_name}</span> ({editingItem.employee.employee_id})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {/* Shift info summary */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 grid grid-cols-2 gap-3 text-slate-300">
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Ca làm việc</p>
              <p className="font-semibold text-white mt-0.5">{editingItem.shiftName}</p>
              <p className="text-[10px] font-mono text-slate-400">{editingItem.shiftTimeRange}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Thời gian điểm danh</p>
              <p className="text-[10px] font-mono mt-0.5">Vào ca: <span className="text-white font-semibold">{editingItem.inTime}</span></p>
              <p className="text-[10px] font-mono">Tan ca: <span className="text-white font-semibold">{editingItem.outTime}</span></p>
            </div>
          </div>

          {modalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Input 1: Late / Early */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-rose-400" />
                Thời gian Đi trễ / Về sớm
              </label>
              <span className="text-[10px] text-slate-400">
                Thực tế: <span className="font-mono text-rose-400 font-semibold">{formatSecondsToHHMMSS(editingItem.initialLateEarlySec)}</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Giờ</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={inputLEHours}
                  onChange={(e) => handleLEChange(parseInt(e.target.value, 10) || 0, inputLEMinutes, inputLESeconds)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Phút</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inputLEMinutes}
                  onChange={(e) => handleLEChange(inputLEHours, parseInt(e.target.value, 10) || 0, inputLESeconds)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Giây</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inputLESeconds}
                  onChange={(e) => handleLEChange(inputLEHours, inputLEMinutes, parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Input 2: Overtime */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="font-semibold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                Thời gian Tăng ca (OT)
              </label>
              <span className="text-[10px] text-slate-400">
                Thực tế: <span className="font-mono text-emerald-400 font-semibold">{formatSecondsToHHMMSS(editingItem.initialOTSec)}</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Giờ</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={inputOTHours}
                  onChange={(e) => handleOTChange(parseInt(e.target.value, 10) || 0, inputOTMinutes, inputOTSeconds)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Phút</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inputOTMinutes}
                  onChange={(e) => handleOTChange(inputOTHours, parseInt(e.target.value, 10) || 0, inputOTSeconds)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Giây</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={inputOTSeconds}
                  onChange={(e) => handleOTChange(inputOTHours, inputOTMinutes, parseInt(e.target.value, 10) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-center font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={Boolean(modalError)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all ${
              modalError
                ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 cursor-pointer shadow-lg shadow-cyan-600/20'
            }`}
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
};
