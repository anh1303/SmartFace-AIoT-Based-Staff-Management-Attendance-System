import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/api/client', () => ({apiFetch:vi.fn(async () => ({success:true,data:{}}))}));
import { apiFetch } from '../src/api/client';
import { updatePayrollItemApi } from '../src/api/payrollApi';
describe('Payroll override request', () => {
  it('transmits the approval reason and preserves explicit zero hours', async () => {
    await updatePayrollItemApi('123',{working_hours:0,total_overtime:0,total_late_early:0,reason:'Đã kiểm tra sự cố'});
    const [,options] = vi.mocked(apiFetch).mock.calls.at(-1)!;
    const body = JSON.parse(options!.body as string);
    expect(body.reason).toBe('Đã kiểm tra sự cố');expect(body.total_working_hours).toBe(0);expect(body.total_overtime).toBe(0);
  });
});
