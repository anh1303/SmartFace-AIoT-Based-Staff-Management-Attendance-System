import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/api/client', () => ({apiFetch:vi.fn(async () => ({success:true,data:{}}))}));
import { apiFetch } from '../../src/api/client';
import { updatePayrollItemApi } from '../../src/api/payrollApi';
describe('Payroll override request', () => {
  it('sends an explicit rate snapshot resolution with its reason and version', async () => {
    await updatePayrollItemApi('123', { resolve_rate_snapshot: true, reason: 'Confirm current policy', updated_at: '2026-10-29T00:00:00Z' });
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    expect(JSON.parse(options!.body as string)).toEqual({ resolve_rate_snapshot: true, reason: 'Confirm current policy', updated_at: '2026-10-29T00:00:00Z' });
  });
  it('sends allowance alone without acknowledging hours and retains the version', async () => {
    await updatePayrollItemApi('123', { allowance: 0, reason: 'Allowance only', updated_at: '2026-10-29T00:00:00Z' });
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    expect(JSON.parse(options!.body as string)).toEqual({ allowance: 0, reason: 'Allowance only', updated_at: '2026-10-29T00:00:00Z' });
  });
  it('sends an explicit reconciliation even when the desired hours are unchanged', async () => {
    await updatePayrollItemApi('123', { total_working_hours: 8, reconcile_working_hours: true, reason: 'Reviewed attendance' });
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    expect(JSON.parse(options!.body as string)).toEqual({ total_working_hours: 8, reconcile_working_hours: true, reason: 'Reviewed attendance' });
  });
  it('can reset a manual hours override to attendance source', async () => {
    await updatePayrollItemApi('123', { reset_working_hours: true, reason: 'Use source attendance' });
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    expect(JSON.parse(options!.body as string)).toEqual({ reset_working_hours: true, reason: 'Use source attendance' });
  });
  it('transmits the approval reason and preserves explicit zero hours', async () => {
    await updatePayrollItemApi('123',{working_hours:0,total_overtime:0,total_late_early:0,reason:'Đã kiểm tra sự cố'});
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    const body = JSON.parse(options!.body as string);
    expect(body.reason).toBe('Đã kiểm tra sự cố');expect(body.total_working_hours).toBe(0);expect(body.total_overtime).toBe(0);
  });
});
