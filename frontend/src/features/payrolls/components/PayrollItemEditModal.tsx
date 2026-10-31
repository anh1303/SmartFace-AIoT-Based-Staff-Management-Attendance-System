import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Check, ArrowRight } from 'lucide-react';
import { PayrollRecord } from '../../../types';
import type { PayrollItemUpdates } from '../../../api/payrollApi';
import { PayslipBreakdown } from './PayslipBreakdown';

export interface EditingPayrollItem {
  record: PayrollRecord;
  empName: string;
  allowance: number;
  reason: string;
}

export function buildPayrollItemUpdates(item: EditingPayrollItem): PayrollItemUpdates {
  const reason = item.reason.trim();
  if (reason.length < 3) throw new Error('Lý do điều chỉnh cần ít nhất 3 ký tự.');
  const record = item.record;
  const updates: PayrollItemUpdates = { allowance: item.allowance, reason, updated_at: record.updated_at };
  return updates;
}

interface PayrollItemEditModalProps {
  editingItem: EditingPayrollItem | null;
  onClose: () => void;
  onChangeEditingItem: (item: EditingPayrollItem) => void;
  onConfirmSave: (e: React.FormEvent) => void;
  otRate: number;
  lateRate: number;
  selectedPeriod: string;
  isSubmitting?: boolean;
}

export const PayrollItemEditModal: React.FC<PayrollItemEditModalProps> = ({ editingItem: item, onClose, onChangeEditingItem: change, onConfirmSave, selectedPeriod, isSubmitting = false }) => {
  if (!item) return null;
  const record = item.record;
  const money = (n: number) => `${n.toLocaleString('vi-VN')} ₫`;
  return <Modal isOpen onClose={() => { if (!isSubmitting) onClose(); }} title="Điều chỉnh phiếu lương & phụ cấp" subtitle={`${item.empName} · ${record.employee_id} · Kỳ ${selectedPeriod}`} maxWidth="2xl">
    <form onSubmit={onConfirmSave} className="space-y-4">
      <p className="text-sm text-slate-500">Phụ cấp được sửa trên phiếu chờ duyệt. OT và phạt được xét duyệt riêng theo ngày. Thực lĩnh mới được hệ thống tính sau khi lưu.</p>
      <label className="sf-field">Phụ cấp (VNĐ):<input className="sf-input text-lg font-semibold" type="number" step={50000} min={0} value={item.allowance} disabled={isSubmitting} onChange={e => change({ ...item, allowance: Number(e.target.value) })}/></label>
      <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
        <div><p className="sf-secondary">Hiện tại</p><strong>{money(record.allowance ?? 0)}</strong></div><ArrowRight size={17} className="text-slate-400"/>
        <div><p className="sf-secondary">Sau điều chỉnh</p><strong className="text-blue-700">{money(item.allowance)}</strong></div>
        <div><p className="sf-secondary">Chênh lệch phụ cấp</p><strong>{money(item.allowance - (record.allowance ?? 0))}</strong></div>
      </div>
      <label className="sf-field">Lý do điều chỉnh:<textarea className="sf-input" required minLength={3} maxLength={2000} rows={2} value={item.reason} disabled={isSubmitting} onChange={e => change({ ...item, reason: e.target.value })} placeholder="Nêu lý do để lưu vết điều chỉnh…"/></label>
      <section aria-label="Kết quả đã lưu"><h3 className="font-medium text-sm">Kết quả đã lưu trước điều chỉnh</h3><PayslipBreakdown record={record}/></section>
      <div className="sf-footer"><button type="button" disabled={isSubmitting} className="sf-button" onClick={onClose}>Hủy bỏ</button><button className="sf-button primary" disabled={isSubmitting}><Check size={16}/>{isSubmitting ? 'Đang lưu thay đổi…' : 'Xác nhận cập nhật bảng lương'}</button></div>
    </form>
  </Modal>;
};
