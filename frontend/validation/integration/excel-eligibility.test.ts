import { describe, expect, it, vi } from 'vitest';
import { exportScheduleToExcel } from '../../src/features/schedules/utils/scheduleExport';
import { canExportPayroll } from '../../src/features/payrolls/payrollExportEligibility';

vi.mock('../../src/utils/excelExport', () => ({ exportToExcel: vi.fn().mockResolvedValue(false) }));
import { exportToExcel } from '../../src/utils/excelExport';

describe('schedule Excel eligibility', () => {
  it('exports only employees with a working shift in the selected week', () => {
    const employees = [{ employee_id: 'a', full_name: 'A' }, { employee_id: 'b', full_name: 'B' }, { employee_id: 'c', full_name: 'C' }] as any;
    exportScheduleToExcel({ filteredEmployees: employees, daysOfWeek: [{ date: '2026-11-02', name: 'T2', label: '02/11' }] as any, workShifts: [
      { employee_id: 'a', date: '2026-11-02', shift_type: 'MORNING', start_time: '08:00', end_time: '12:00' },
      { employee_id: 'b', date: '2026-11-02', shift_type: 'OFF' },
      { employee_id: 'c', date: '2026-11-09', shift_type: 'MORNING' },
    ] as any, weekNumber: 45, startLabel: '02/11', endLabel: '08/11' });
    expect(vi.mocked(exportToExcel).mock.calls.at(-1)?.[0].rows.map(row => row[0])).toEqual(['a']);
  });

  it('does not create a workbook when no employee has a working shift', () => {
    vi.mocked(exportToExcel).mockClear();
    exportScheduleToExcel({ filteredEmployees: [{ employee_id: 'a' }] as any, daysOfWeek: [{ date: '2026-11-02' }] as any, workShifts: [{ employee_id: 'a', date: '2026-11-02', shift_type: 'OFF' }] as any, weekNumber: 45, startLabel: '', endLabel: '' });
    expect(exportToExcel).not.toHaveBeenCalled();
  });
});

describe('payroll Excel eligibility', () => {
  it('requires a finalized regular period and no pending exported records', () => {
    const regular = { status: 'FINALIZED' };
    const early = { status: 'FINALIZED', calculation_details: { early_settlement: { is_early_settlement: true } } };
    expect(canExportPayroll([] as any)).toBe(false);
    expect(canExportPayroll([early] as any)).toBe(false);
    expect(canExportPayroll([regular, { status: 'PENDING' }] as any)).toBe(false);
    expect(canExportPayroll([regular, early] as any)).toBe(true);
  });
});
