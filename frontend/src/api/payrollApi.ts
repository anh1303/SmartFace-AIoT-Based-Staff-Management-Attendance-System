import { apiFetch } from './client';
import { PayrollRecord, BonusPenaltyPolicy } from '../types';

export type PayrollItemUpdates = Partial<Pick<PayrollRecord,
  'hourly_rate' | 'total_working_hours' | 'total_overtime' | 'total_late_early' | 'allowance' | 'status' | 'reason' | 'updated_at'
>> & {
  working_hours?: number;
  reconcile_working_hours?: boolean;
  reset_working_hours?: boolean;
  resolve_rate_snapshot?: boolean;
};

export async function fetchPayrollApi(): Promise<PayrollRecord[]> {
  const res = await apiFetch('/api/payroll');
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  throw new Error(res.message || 'Không thể tải bảng lương');
}

export async function fetchBonusPenaltyApi(): Promise<BonusPenaltyPolicy | null> {
  const res = await apiFetch('/api/payroll/bonus-penalty');
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
  const workingHours = updates.working_hours ?? updates.total_working_hours;
  const res = await apiFetch(`/api/payroll/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      hourly_rate: updates.hourly_rate,
      total_working_hours: workingHours,
      total_overtime: updates.total_overtime,
      total_late_early: updates.total_late_early,
      allowance: updates.allowance,
      status: updates.status,
      reason: updates.reason,
      updated_at: updates.updated_at,
      reconcile_working_hours: updates.reconcile_working_hours,
      reset_working_hours: updates.reset_working_hours,
      resolve_rate_snapshot: updates.resolve_rate_snapshot,
    }),
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
