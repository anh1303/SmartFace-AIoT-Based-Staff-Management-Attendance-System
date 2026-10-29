import { describe, expect, it } from 'vitest';
import * as modal from '../src/features/payrolls/components/PayrollItemEditModal';
import type { EditingPayrollItem } from '../src/features/payrolls/components/PayrollItemEditModal';

const item: EditingPayrollItem = {
  record: { payroll_id: '1', employee_id: 'NV01', period: '2026-10', hourly_rate: 100, total_working_hours: 8, total_overtime: 2, total_late_early: 1, allowance: 40, net_salary: 900, status: 'PENDING', updated_at: '2026-10-29T00:00:00Z' },
  empName: 'Employee', hourly_rate: 100, working_hours: 8, total_overtime: 2, total_late_early: 1, allowance: 50, reason: 'Allowance adjustment',
};

describe('Payroll form request', () => {
  it('does not resend untouched hours or rates on an allowance edit', () => {
    expect(modal.buildPayrollItemUpdates(item)).toEqual({ allowance: 50, reason: 'Allowance adjustment', updated_at: '2026-10-29T00:00:00Z' });
  });
  it('explicitly confirms unchanged stale hours and the legacy rate when requested', () => {
    const legacy = { ...item, allowance: 40, hours_resolution: 'confirm' as const, record: { ...item.record, calculation_details: { legacy_manual_unresolved: true } } };
    expect(modal.buildPayrollItemUpdates(legacy)).toEqual({ total_working_hours: 8, reconcile_working_hours: true, hourly_rate: 100, reason: 'Allowance adjustment', updated_at: '2026-10-29T00:00:00Z' });
  });
  it('resets to source without supplying edited manual hours', () => {
    expect(modal.buildPayrollItemUpdates({ ...item, hours_resolution: 'reset', working_hours: 99 })).toEqual({ allowance: 50, reset_working_hours: true, reason: 'Allowance adjustment', updated_at: '2026-10-29T00:00:00Z' });
  });
  it.each(['confirm', 'reset'] as const)('confirms the rate for a raw legacy manual record on %s before regeneration', (hours_resolution) => {
    const updates = modal.buildPayrollItemUpdates({ ...item, hours_resolution, record: { ...item.record, calculation_details: { manual: true } } });
    expect(updates.hourly_rate).toBe(100);
    expect(updates[hours_resolution === 'confirm' ? 'reconcile_working_hours' : 'reset_working_hours']).toBe(true);
  });
  it('rejects whitespace-only reasons before sending any update', () => {
    expect(() => modal.buildPayrollItemUpdates({ ...item, reason: '   ' })).toThrow('Lý do');
  });
  it('explicitly resolves missing rate snapshots without acknowledging manual hours', () => {
    expect(modal.buildPayrollItemUpdates({ ...item, allowance: 40, resolve_rate_snapshot: true })).toEqual({ resolve_rate_snapshot: true, reason: 'Allowance adjustment', updated_at: '2026-10-29T00:00:00Z' });
  });
});
