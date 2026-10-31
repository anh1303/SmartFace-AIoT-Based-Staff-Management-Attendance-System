import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { nextPayrollPolicyPeriod } from '../../../utils/payrollUtils';
import { fetchBonusPenaltyApi } from '../../../api/payrollApi';

export interface PolicyFormData {
  overtime_rate: number;
  late_early_penalty: number;
  absence_penalty_rate: number;
  description: string;
  effective_period: string;
}

interface PayrollPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyData: PolicyFormData;
  onChangePolicyData: React.Dispatch<React.SetStateAction<PolicyFormData>>;
  onSavePolicy: (e: React.FormEvent) => void;
}

export const PayrollPolicyModal: React.FC<PayrollPolicyModalProps> = ({
  isOpen,
  onClose,
  policyData,
  onChangePolicyData,
  onSavePolicy,
}) => {
  const baseline = useRef<PolicyFormData>(policyData);
  const requestId = useRef(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<PolicyFormData | null>(null);

  useEffect(() => {
    if (isOpen) {
      baseline.current = policyData;
      setLoading(false); setError(''); setProposal(null);
    }
    return () => { requestId.current += 1; };
    // The starting baseline must not change when the user edits the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadPeriod = async (period: string) => {
    const id = ++requestId.current;
    const dirty = (['overtime_rate', 'late_early_penalty', 'absence_penalty_rate', 'description'] as const)
      .some(key => policyData[key] !== baseline.current[key]);
    onChangePolicyData(current => ({ ...current, effective_period: period }));
    setProposal(null); setError('');
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) { setLoading(false); setError('Vui lòng chọn kỳ hiệu lực hợp lệ.'); return; }
    setLoading(true);
    try {
      const policy = await fetchBonusPenaltyApi(period);
      if (id !== requestId.current) return;
      if (!policy || policy.absence_penalty_rate == null) throw new Error('Không có chính sách được xác minh cho kỳ này.');
      const next: PolicyFormData = { effective_period: period, overtime_rate: Number(policy.overtime_rate), late_early_penalty: Number(policy.late_early_penalty), absence_penalty_rate: Number(policy.absence_penalty_rate), description: policy.description || '' };
      if (![next.overtime_rate, next.late_early_penalty, next.absence_penalty_rate].every(rate => Number.isFinite(rate) && rate >= 0 && rate <= 50)) throw new Error('Hệ số không hợp lệ');
      if (dirty) setProposal(next);
      else { baseline.current = next; onChangePolicyData(next); }
    } catch {
      if (id === requestId.current) setError('Không tải được chính sách của kỳ đã chọn. Vui lòng thử lại.');
    } finally { if (id === requestId.current) setLoading(false); }
  };

  const choosePolicy = (useNew: boolean) => {
    if (!proposal) return;
    baseline.current = proposal;
    if (useNew) onChangePolicyData(proposal);
    setProposal(null);
  };
  const blocked = loading || Boolean(error) || Boolean(proposal);
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thay đổi quy định Thưởng / Phạt"
      subtitle="Thiết lập hệ số tăng ca (OT), phạt trễ/sớm và phạt vắng theo lương giờ (Quyền hạn: Admin)"
    >
      <form onSubmit={e => { if (blocked) { e.preventDefault(); return; } onSavePolicy(e); }} className="space-y-4">
        <label className="sf-field">Áp dụng từ kỳ lương
          <input className="sf-input" type="month" min={nextPayrollPolicyPeriod()} required value={policyData.effective_period}
            onChange={e => void loadPeriod(e.target.value)}/>
        </label>
        <p className="text-xs text-slate-500">Lưu thành phiên bản mới từ tháng đã chọn. Các kỳ trước giữ chính sách đã áp dụng; mỗi tháng chỉ có một phiên bản.</p>
        {loading && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Đang tải chính sách của kỳ đã chọn…</p>}
        {error && <div role="alert" className="text-sm text-rose-700 dark:text-rose-300"><p>{error}</p><button type="button" className="underline" onClick={() => void loadPeriod(policyData.effective_period)}>Thử lại</button></div>}
        {proposal && <div role="status" className="rounded-lg border border-amber-300 p-3 text-sm text-amber-900 dark:text-amber-200">
          <p>Bạn đã sửa giá trị. Dùng chính sách của kỳ mới hay giữ giá trị đang nhập?</p>
          <p className="mt-1">Chính sách kỳ mới: OT {proposal.overtime_rate}× · Trễ/sớm {proposal.late_early_penalty}× · Vắng {proposal.absence_penalty_rate}×.</p>
          {proposal.description && <p className="mt-1 break-words">Ghi chú: {proposal.description}</p>}
          <div className="mt-2 flex flex-wrap gap-3"><button type="button" className="underline" onClick={() => choosePolicy(true)}>Dùng chính sách kỳ mới</button><button type="button" className="underline" onClick={() => choosePolicy(false)}>Giữ giá trị đang nhập</button></div>
        </div>}
        <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300">
          💡 Công thức tính thống nhất: <strong>Số tiền = Số giờ × Hệ số × Lương theo giờ</strong>
        </div>

        <fieldset disabled={blocked} className="space-y-4 disabled:opacity-60">
        <div>
          <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">
            Hệ số thưởng làm thêm giờ (OT)
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step="0.0001"
            value={policyData.overtime_rate}
            onChange={(e) =>
              onChangePolicyData((p) => ({
                ...p,
                overtime_rate: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
            placeholder="Ví dụ: 2.0 (200% lương giờ)"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">Mặc định: <strong>2.0x</strong> lương theo giờ.</p>
        </div>

        <div>
          <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">
            Hệ số phạt đi trễ / về sớm
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step="0.0001"
            value={policyData.late_early_penalty}
            onChange={(e) =>
              onChangePolicyData((p) => ({
                ...p,
                late_early_penalty: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
            placeholder="Ví dụ: 1.5 (150% lương giờ)"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">Mặc định: <strong>1.5x</strong> lương theo giờ.</p>
        </div>

        <div>
          <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">
            Hệ số phạt nghỉ làm không lý do (Vắng ca)
          </label>
          <input
            type="number"
            min={0}
            max={50}
            step="0.0001"
            value={policyData.absence_penalty_rate}
            onChange={(e) =>
              onChangePolicyData((p) => ({
                ...p,
                absence_penalty_rate: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
            placeholder="Ví dụ: 2.0 (200% lương giờ ca vắng)"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">Mặc định: <strong>2.0x</strong> lương giờ của ca vi phạm.</p>
        </div>

        <div>
          <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">
            Ghi chú / Mô tả quy định
          </label>
          <textarea
            rows={2}
            value={policyData.description}
            onChange={(e) =>
              onChangePolicyData((p) => ({
                ...p,
                description: e.target.value,
              }))
            }
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
            placeholder="Mô tả chính sách áp dụng..."
          />
        </div>

        </fieldset>
        <div className="pt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-[#0f1224] dark:hover:bg-[#1a1e3a] border border-slate-200 dark:border-[#272d5a] cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={blocked}
            className="px-4 py-2 rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20 cursor-pointer"
          >
            Lưu quy định
          </button>
        </div>
      </form>
    </Modal>
  );
};
