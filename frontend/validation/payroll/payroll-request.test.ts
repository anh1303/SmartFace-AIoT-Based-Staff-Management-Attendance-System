import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/api/client', () => ({apiFetch:vi.fn(async () => ({success:true,data:{}}))}));
import { apiFetch } from '../../src/api/client';
import { updatePayrollItemApi } from '../../src/api/payrollApi';
describe('Payroll override request', () => {
  it('sends allowance alone without acknowledging hours and retains the version', async () => {
    await updatePayrollItemApi('123', { allowance: 0, reason: 'Allowance only', updated_at: '2026-10-29T00:00:00Z' });
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    expect(JSON.parse(options!.body as string)).toEqual({ allowance: 0, reason: 'Allowance only', updated_at: '2026-10-29T00:00:00Z' });
  });
});
