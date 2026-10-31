import { describe, expect, it } from 'vitest';
import * as modal from '../../src/features/payrolls/components/PayrollItemEditModal';
import type { EditingPayrollItem } from '../../src/features/payrolls/components/PayrollItemEditModal';

const item: EditingPayrollItem = {
  record: { payroll_id: '1', employee_id: 'NV01', period: '2026-10', hourly_rate: 100, total_working_hours: 8, total_overtime: 2, total_late_early: 1, allowance: 40, net_salary: 900, status: 'PENDING', updated_at: '2026-10-29T00:00:00Z' },
  empName: 'Employee', allowance: 50, reason: 'Allowance adjustment',
};

describe('Payroll form request', () => {
  it('does not resend untouched hours or rates on an allowance edit', () => {
    expect(modal.buildPayrollItemUpdates(item)).toEqual({ allowance: 50, reason: 'Allowance adjustment', updated_at: '2026-10-29T00:00:00Z' });
  });
  it('rejects whitespace-only reasons before sending any update', () => {
    expect(() => modal.buildPayrollItemUpdates({ ...item, reason: '   ' })).toThrow('Lý do');
  });

});
