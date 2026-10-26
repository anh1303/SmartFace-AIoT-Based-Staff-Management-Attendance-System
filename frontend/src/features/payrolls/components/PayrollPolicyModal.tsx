import React from 'react';
import { Modal } from '../../../components/common/Modal';

export interface PolicyFormData {
  overtime_rate: number;
  late_early_penalty: number;
  absence_penalty_rate: number;
  description: string;
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Thay đổi quy định Thưởng / Phạt"
      subtitle="Thiết lập hệ số tăng ca (OT) và định mức vi phạm đi trễ / về sớm (Quyền hạn: Admin)"
    >
      <form onSubmit={onSavePolicy} className="space-y-4">
        <div>
          <label className="block text-xs mb-1" htmlFor="absence-penalty-rate">Phạt vắng ca (% tiền công của ca)</label>
          <input id="absence-penalty-rate" type="number" min="0" max="100" step="0.01" required value={Number((policyData.absence_penalty_rate * 100).toFixed(2))}
            onChange={e => onChangePolicyData(p => ({ ...p, absence_penalty_rate: Number(e.target.value) / 100 }))}
            className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
          <p className="text-xs text-slate-500 mt-1">Mặc định 25% × số giờ ca × lương giờ. Manager duyệt từng ngày trước khi trừ lương.</p>
        </div>
        <div>
          <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">
            Mức thưởng OT (Hệ số x hoặc ₫/h)
          </label>
          <input
            type="number"
            step="any"
            value={policyData.overtime_rate}
            onChange={(e) =>
              onChangePolicyData((p) => ({
                ...p,
                overtime_rate: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            placeholder="Ví dụ: 1.5 (gấp 1.5x) hoặc 100000 (100.000 ₫/h)"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Nhập ≤ 10 nếu là hệ số nhân lương giờ (VD: 1.5x), nhập &gt; 10 nếu là số tiền ₫/h (VD:
            100000 ₫/h).
          </p>
        </div>

        <div>
          <label className="block text-xs text-slate-700 dark:text-slate-400 font-medium mb-1">
            Mức phạt đi trễ / về sớm (Hệ số x hoặc ₫/h)
          </label>
          <input
            type="number"
            step="any"
            value={policyData.late_early_penalty}
            onChange={(e) =>
              onChangePolicyData((p) => ({
                ...p,
                late_early_penalty: parseFloat(e.target.value) || 0,
              }))
            }
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 font-mono"
            placeholder="Ví dụ: 50000 (50.000 ₫/h)"
            required
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Nhập ≤ 10 nếu là hệ số khấu trừ lương giờ, nhập &gt; 10 nếu là số tiền phạt ₫/h.
          </p>
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
            className="w-full bg-slate-50 dark:bg-[#0f1224] border border-slate-200 dark:border-[#272d5a] rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
            placeholder="Mô tả chính sách áp dụng..."
          />
        </div>

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
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-500/20 cursor-pointer"
          >
            Lưu thay đổi quy định
          </button>
        </div>
      </form>
    </Modal>
  );
};
