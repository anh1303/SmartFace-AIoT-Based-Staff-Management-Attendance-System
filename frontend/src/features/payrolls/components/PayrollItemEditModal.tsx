import React from 'react';
import { Modal } from '../../../components/common/Modal';
import { Check, ArrowRight } from 'lucide-react';
import { PayrollRecord } from '../../../types';
import type { PayrollItemUpdates } from '../../../api/payrollApi';
import { PayslipBreakdown } from './PayslipBreakdown';

export interface EditingPayrollItem {
  record: PayrollRecord;
  empName: string;
  hourly_rate: number;
  working_hours: number;
  total_overtime: number;
  total_late_early: number;
  allowance: number;
  reason: string;
  hours_resolution?: 'confirm' | 'reset';
  resolve_rate_snapshot?: boolean;
}

export function buildPayrollItemUpdates(item: EditingPayrollItem): PayrollItemUpdates {
  const reason = item.reason.trim();
  if (reason.length < 3) throw new Error('Lý do điều chỉnh cần ít nhất 3 ký tự.');
  const record = item.record;
  const updates: PayrollItemUpdates = { reason, updated_at: record.updated_at };
  if (item.allowance !== Number(record.allowance ?? 0)) updates.allowance = item.allowance;
  if (item.hourly_rate !== Number(record.hourly_rate)) updates.hourly_rate = item.hourly_rate;
  if (item.resolve_rate_snapshot) updates.resolve_rate_snapshot = true;
  if (item.hours_resolution === 'reset') {
    updates.reset_working_hours = true;
  } else if (item.hours_resolution === 'confirm') {
    updates.total_working_hours = item.working_hours;
    updates.reconcile_working_hours = true;
  } else if (item.working_hours !== Number(record.total_working_hours ?? record.working_hours ?? 0)) {
    updates.total_working_hours = item.working_hours;
  }
  const details = record.calculation_details as { legacy_manual_unresolved?: boolean; manual?: boolean; field_overrides?: unknown } | null | undefined;
  const legacyManual = details?.legacy_manual_unresolved || (details?.manual === true && !details.field_overrides);
  if (item.hours_resolution && legacyManual) updates.hourly_rate = item.hourly_rate;
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
      <details className="sf-panel p-3" open={record.requires_reconciliation || undefined}>
        <summary className="font-medium text-sm">Đơn giá & giờ công · Điều chỉnh và đối soát</summary>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="sf-field">Lương theo giờ (VNĐ/h):<input className="sf-input" type="number" step="any" min={0} required value={item.hourly_rate} disabled={isSubmitting} onChange={e => change({ ...item, hourly_rate: Number(e.target.value) })}/></label>
          <label className="sf-field">Tổng số giờ làm việc (h):<input className="sf-input" type="number" step="any" min={0} required value={item.working_hours} disabled={isSubmitting || item.hours_resolution === 'reset'} onChange={e => change({ ...item, working_hours: Number(e.target.value) })}/></label>
        </div>
        <fieldset disabled={isSubmitting} className="space-y-3 mt-4">
          <legend className="font-medium text-sm mb-2">Đối soát giờ công điều chỉnh</legend>
          <label className="flex gap-2 items-start"><input type="radio" name="hours-resolution" checked={!item.hours_resolution} onChange={() => change({ ...item, hours_resolution: undefined })}/>Giữ nguyên trạng thái đối soát</label>
          <label className="flex gap-2 items-start"><input type="radio" name="hours-resolution" checked={item.hours_resolution === 'confirm'} onChange={() => change({ ...item, hours_resolution: 'confirm' })}/>Đã đối chiếu dữ liệu nguồn; xác nhận giờ công và đơn giá đang hiển thị</label>
          <label className="flex gap-2 items-start"><input type="radio" name="hours-resolution" checked={item.hours_resolution === 'reset'} onChange={() => change({ ...item, hours_resolution: 'reset' })}/>Bỏ giờ công điều chỉnh, dùng giờ từ chấm công; xác nhận đơn giá đang hiển thị</label>
          <p className="sf-secondary">Thay đổi phụ cấp không xác nhận giờ công cũ. Chọn rõ cách đối soát nếu phiếu đang cần đối soát.</p>
        </fieldset>
      </details>
      <section aria-label="Kết quả đã lưu"><h3 className="font-medium text-sm">Kết quả đã lưu trước điều chỉnh</h3><PayslipBreakdown record={record}/></section>
      <div className="sf-footer"><button type="button" disabled={isSubmitting} className="sf-button" onClick={onClose}>Hủy bỏ</button><button className="sf-button primary" disabled={isSubmitting}><Check size={16}/>{isSubmitting ? 'Đang lưu thay đổi…' : 'Xác nhận cập nhật bảng lương'}</button></div>
    </form>
  </Modal>;
};
