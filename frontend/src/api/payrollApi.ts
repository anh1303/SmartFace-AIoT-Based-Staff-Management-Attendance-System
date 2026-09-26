import { apiFetch } from './client';
import { PayrollRecord, BonusPenaltyPolicy } from '../types';

export async function fetchPayrollApi(): Promise<PayrollRecord[]> {
  const res = await apiFetch('/api/payroll');
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  return [];
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
  updates: Partial<PayrollRecord> & { working_hours?: number }
): Promise<PayrollRecord> {
  const workingHours = updates.working_hours ?? updates.total_working_hours;
  const res = await apiFetch(`/api/payroll/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      hourly_rate: updates.hourly_rate,
      total_working_hours: workingHours,
      working_hours: workingHours,
      total_overtime: updates.total_overtime,
      total_late_early: updates.total_late_early,
      allowance: updates.allowance,
      status: updates.status,
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

export async function unlockPayrollPeriodApi(period: string): Promise<PayrollRecord[]> {
  const res = await apiFetch(`/api/payroll/period/${period}/unlock`, {
    method: 'POST',
  });
  if (res.success && Array.isArray(res.data)) {
    return res.data;
  }
  throw new Error(res.message || 'Lỗi mở khoá bảng lương');
}

export async function updateBonusPenaltyApi(data: { overtime_rate?: number; late_early_penalty?: number; description?: string }): Promise<BonusPenaltyPolicy> {
  const res = await apiFetch('/api/payroll/bonus-penalty', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  if (res.success && res.data) {
    return res.data;
  }
  throw new Error(res.message || 'Lỗi cập nhật thưởng/phạt');
}
