import React, { useEffect, useState } from 'react';
import { Modal } from '../../../components/common/Modal';
import { Check } from 'lucide-react';
import { PayrollRecord } from '../../../types';
import type { PayrollItemUpdates } from '../../../api/payrollApi';

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
  absenceLabel: string;
  isSubmitting?: boolean;
}

export const PayrollItemEditModal: React.FC<PayrollItemEditModalProps> = ({ editingItem: item, onClose, onChangeEditingItem: change, onConfirmSave, selectedPeriod, absenceLabel, isSubmitting = false }) => {
  const [allowanceInput, setAllowanceInput] = useState('');
  useEffect(() => {
    setAllowanceInput(item ? String(item.allowance) : '');
  }, [item?.record.payroll_id]);
  if (!item) return null;
  const record = item.record;
  const breakdown = record.breakdown;
  const estimatedNet = breakdown
    ? Math.max(0, Math.round(breakdown.base_salary + breakdown.overtime_pay - breakdown.late_early_deduction - breakdown.absence_deduction + item.allowance))
    : record.net_salary > 0 || item.allowance === record.allowance
      ? Math.max(0, record.net_salary + item.allowance - (record.allowance ?? 0))
      : null;
  return <Modal isOpen onClose={() => { if (!isSubmitting) onClose(); }} title="Điều chỉnh phụ cấp" subtitle={`${item.empName} · ${record.employee_id} · Kỳ ${selectedPeriod}`} maxWidth="2xl">
    <form onSubmit={onConfirmSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="sf-field">Lương theo giờ<input className="sf-input" value={`${record.hourly_rate.toLocaleString('vi-VN')} ₫`} readOnly /></label>
        <label className="sf-field">Tổng giờ làm<input className="sf-input" value={`${record.total_working_hours ?? record.working_hours ?? 0} giờ`} readOnly /></label>
        <label className="sf-field">Tăng ca<input className="sf-input" value={`${record.total_overtime ?? 0} giờ`} readOnly /></label>
        <label className="sf-field">Đi trễ / Về sớm<input className="sf-input" value={`${record.total_late_early ?? 0} giờ`} readOnly /></label>
        <label className="sf-field">Nghỉ làm không lý do<input className="sf-input" value={absenceLabel} readOnly /></label>
      </div>
      <label className="sf-field">Phụ cấp<div className="relative"><input className="sf-input text-lg font-semibold pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" type="number" step={50000} min={0} required value={allowanceInput} disabled={isSubmitting} onChange={e => { setAllowanceInput(e.target.value); if (e.target.value !== '') change({ ...item, allowance: Number(e.target.value) }); }}/><span aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none">đ</span></div></label>
      <label className="sf-field">Thực lĩnh dự kiến sau điều chỉnh<input className="sf-input font-semibold" value={allowanceInput === '' ? '—' : estimatedNet == null ? 'Chưa đủ dữ liệu để tính' : `${estimatedNet.toLocaleString('vi-VN')} ₫`} readOnly /></label>
      <label className="sf-field">Lý do điều chỉnh:<textarea className="sf-input" required minLength={3} maxLength={2000} rows={2} value={item.reason} disabled={isSubmitting} onChange={e => change({ ...item, reason: e.target.value })} placeholder="Nêu lý do để lưu vết điều chỉnh…"/></label>
      <div className="sf-footer"><button type="button" disabled={isSubmitting} className="sf-button" onClick={onClose}>Hủy bỏ</button><button className="sf-button primary" disabled={isSubmitting}><Check size={16}/>{isSubmitting ? 'Đang lưu thay đổi…' : 'Xác nhận cập nhật bảng lương'}</button></div>
    </form>
  </Modal>;
};
