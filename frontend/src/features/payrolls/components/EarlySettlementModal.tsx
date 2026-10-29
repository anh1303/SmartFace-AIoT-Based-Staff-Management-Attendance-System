import React, { useEffect, useState } from 'react';
import { previewEarlySettlementApi, type EarlySettlementPreview } from '../../../api/payrollApi';
import { Modal } from '../../../components/common/Modal';
import { AlertCircle, Calendar, UserCheck, ShieldAlert } from 'lucide-react';
import { PayrollRecord } from '../../../types';

interface EarlySettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: string;
  record: PayrollRecord | null;
  employeeName: string;
  onConfirm: (cutoffDate: string, reason: string) => Promise<void>;
}

export const EarlySettlementModal: React.FC<EarlySettlementModalProps> = ({
  isOpen,
  onClose,
  selectedPeriod,
  record,
  employeeName,
  onConfirm,
}) => {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const defaultCutoff = todayStr.startsWith(selectedPeriod)
    ? todayStr
    : `${selectedPeriod}-01`;

  const [cutoffDate, setCutoffDate] = useState<string>(defaultCutoff);
  const [reason, setReason] = useState<string>('Nhân viên nghỉ việc / chấm dứt hợp đồng lao động');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<EarlySettlementPreview | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCutoffDate(defaultCutoff);
      setPreview(null);
      setErrorMsg(null);
    }
  }, [isOpen, record?.payroll_id, selectedPeriod, defaultCutoff]);

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!cutoffDate.startsWith(selectedPeriod)) {
      setErrorMsg(`Ngày quyết toán phải nằm trong kỳ ${selectedPeriod}`);
      return;
    }
    if (cutoffDate > todayStr) {
      setErrorMsg('Không thể quyết toán sớm cho ngày trong tương lai');
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Vui lòng nhập lý do quyết toán sớm');
      return;
    }

    try {
      setIsSubmitting(true);
      if (!preview) {
        setPreview(await previewEarlySettlementApi({ employeeId: record.employee_id, period: selectedPeriod, cutoffDate, reason: reason.trim() }));
        return;
      }
      if (preview.blocked) return;
      await onConfirm(cutoffDate, reason.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi thực hiện quyết toán sớm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { if (!isSubmitting) onClose(); }}
      title="Quyết toán lương sớm cho nhân viên"
      subtitle={`Nhân viên: ${employeeName} (${record.employee_id}) · Kỳ ${selectedPeriod}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3">
          <UserCheck className="w-5 h-5 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Quy trình quyết toán trước hạn (Offboarding):</p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Hệ thống sẽ tổng hợp công đến hết ngày chốt, kiểm tra các điều chỉnh/OT chưa duyệt,
              hủy các ca làm việc tương lai để không bị tính vắng ca ảo, và khóa phiếu lương này ở trạng thái
              <strong> ĐÃ CHỐT (FINALIZED)</strong> kèm lịch sử kiểm toán. Nhân viên sẽ được chuyển sang trạng thái nghỉ việc ngay khi quyết toán thành công và không thể tiếp tục chấm công.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-600" />
            Ngày làm việc cuối cùng (Cutoff Date):
          </label>
          <input
            type="date"
            value={cutoffDate}
            disabled={isSubmitting}
            onChange={(e) => { setCutoffDate(e.target.value); setPreview(null); }}
            min={`${selectedPeriod}-01`}
            max={todayStr.startsWith(selectedPeriod) ? todayStr : `${selectedPeriod}-${new Date(Date.UTC(Number(selectedPeriod.slice(0, 4)), Number(selectedPeriod.slice(5, 7)), 0)).getUTCDate()}`}
            required
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#272d5a] bg-white dark:bg-[#0f1224] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Chỉ tính giờ công và OT phát sinh từ đầu tháng đến hết ngày này.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            Lý do quyết toán sớm:
          </label>
          <textarea
            value={reason}
            disabled={isSubmitting}
            onChange={(e) => { setReason(e.target.value); setPreview(null); }}
            rows={2}
            placeholder="Ví dụ: Nhân viên nghỉ việc từ ngày 15/10/2026..."
            required
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-[#272d5a] bg-white dark:bg-[#0f1224] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {preview && <div role={preview.blocked ? 'alert' : 'status'} className="p-3 rounded-xl border text-xs space-y-2">
          <p className="font-semibold">Kết quả kiểm tra sau ngày {cutoffDate}</p>
          <p>Giờ công đã ghi nhận: {preview.worked_hours_after_cutoff}. Khoản đã duyệt: {preview.approved_adjustments_after_cutoff}.</p>
          {preview.blocked ? <p className="text-rose-700">Chưa thể quyết toán. Có công thực tế hoặc khoản đã duyệt vào: {preview.conflict_dates.join(', ')}. Hãy đối soát hoặc chọn lại ngày làm việc cuối cùng.</p> : <p>Không có công thực tế hoặc khoản đã duyệt sau ngày chọn. Xác nhận sẽ chốt phiếu và chuyển nhân viên sang nghỉ việc ngay.</p>}
          <p>Ngày có ca sau ngày chọn: {preview.shift_dates_after_cutoff.join(', ') || 'Không có'}.</p>
          <p>Các đề xuất trong kỳ sẽ bị hủy: {preview.adjustments_to_remove.map(a => `${a.date}: ${a.kind} (${a.hours} giờ, ${a.amount.toLocaleString('vi-VN')} ₫)`).join('; ') || 'Không có'}.</p>
        </div>}

        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={isSubmitting || preview?.blocked}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-sm shadow-blue-500/20 cursor-pointer flex items-center gap-1.5"
          >
            {isSubmitting ? 'Đang xử lý...' : preview ? 'Xác nhận quyết toán sớm' : 'Xem trước quyết toán'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
