import { apiFetch } from './client';
import { PayrollRecord, BonusPenaltyPolicy } from '../types';

export type PayrollItemUpdates = { allowance: number; reason?: string; updated_at?: string };

export async function fetchPayrollApi(): Promise<PayrollRecord[]> {
  const res = await apiFetch('/api/payroll');
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  throw new Error(res.message || 'Không thể tải bảng lương');
}

export async function fetchBonusPenaltyApi(period?: string): Promise<BonusPenaltyPolicy | null> {
  const res = await apiFetch(`/api/payroll/bonus-penalty${period ? `?period=${encodeURIComponent(period)}` : ''}`);
  if (res.success && res.data) {
    return res.data;
  }
  return null;
}

export async function generatePayrollApi(period: string): Promise<PayrollRecord[]> {
  const res = await apiFetch('/api/payroll/generate', {
    method: 'POST',
    body: JSON.stringify({ period }),
  });
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  throw new Error(res.message || 'Lỗi khi tính toán bảng lương');
}

export async function updatePayrollItemApi(
  id: string,
  updates: PayrollItemUpdates
): Promise<PayrollRecord> {
  const res = await apiFetch(`/api/payroll/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ allowance: updates.allowance, reason: updates.reason, updated_at: updates.updated_at }),
  });
  if (res.success && res.data) {
    return res.data;
  }
  throw new Error(res.message || 'Lỗi cập nhật phiếu lương');
}

export async function finalizePayrollPeriodApi(period: string) {
  const res = await apiFetch(`/api/payroll/period/${period}/finalize`, {
    method: 'POST',
  });
  return res.data;
}

export async function earlySettlementPayrollApi(payload: {
  employeeId: string;
  period: string;
  cutoffDate: string;
  reason: string;
}) {
  const res = await apiFetch('/api/payroll/early-settlement', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.success) {
    throw new Error(res.message || 'Lỗi quyết toán sớm');
  }
  return res.data;
}

export async function unlockPayrollPeriodApi(period: string): Promise<PayrollRecord[]> {
  const res = await apiFetch(`/api/payroll/period/${period}/unlock`, {
    method: 'POST',
  });
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  throw new Error(res.message || 'Lỗi mở khoá bảng lương');
}

export interface EarlySettlementPreview {
  blocked: boolean;
  conflict_dates: string[];
  worked_hours_after_cutoff: number;
  approved_adjustments_after_cutoff: number;
  shift_dates_after_cutoff: string[];
  adjustments_to_remove: { date: string; kind: string; status: string; hours: number; amount: number }[];
}

export async function previewEarlySettlementApi(payload: { employeeId: string; period: string; cutoffDate: string; reason: string }): Promise<EarlySettlementPreview> {
  const res = await apiFetch('/api/payroll/early-settlement/preview', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.success || !res.data) throw new Error(res.message || 'Không thể xem trước quyết toán');
  return res.data;
}

export async function updateBonusPenaltyApi(data: Partial<Omit<BonusPenaltyPolicy, 'id'>>): Promise<BonusPenaltyPolicy> {
  const res = await apiFetch('/api/payroll/bonus-penalty', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (res.success && res.data) {
    return res.data;
  }
  throw new Error(res.message || 'Lỗi cập nhật thưởng/phạt');
}
