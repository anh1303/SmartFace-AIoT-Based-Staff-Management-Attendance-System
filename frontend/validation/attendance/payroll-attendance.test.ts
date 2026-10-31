import { describe, expect, it } from 'vitest';
import { payrollAttendanceTotals } from '../../src/features/payrolls/payrollAttendance';
import type { BackendAttendanceSummaryItem } from '../../src/features/attendances/hooks/useAttendanceSummaries';
import type { WorkShift } from '../../src/types';

describe('monthly attendance for payroll', () => {
  it('counts absent shifts per employee', () => {
    const rows = [
      { employee_id: 'NV1', status: 'PRESENT', calculation_details: { pairs: [{ start: '2026-10-01T01:00:00Z', end: '2026-10-01T05:30:00Z' }, { start: '2026-10-01T06:00:00Z', end: '2026-10-01T10:00:00Z' }] } },
      { employee_id: 'NV1', date: '2026-10-04', status: 'ABSENT', assigned_shift_type: 'OFF' },
      { employee_id: 'NV1', date: '2026-10-11', status: 'ABSENT', assigned_shift_type: 'OFF' },
      { employee_id: 'NV1', date: '2026-10-12', status: 'ABSENT', assigned_shift_type: 'OFFICE_HOURS' },
      { employee_id: 'NV1', date: '2026-10-22', status: 'ABSENT', assigned_shift_type: 'OFFICE_HOURS' },
      { employee_id: 'NV2', status: 'PRESENT', calculation_details: {} },
    ] as BackendAttendanceSummaryItem[];
    const shifts = [
      { employee_id: 'NV1', date: '2026-10-04', shift_type: 'OFF' },
      { employee_id: 'NV1', date: '2026-10-11', shift_type: 'OFF' },
      { employee_id: 'NV1', date: '2026-10-12', shift_type: 'OFFICE_HOURS' },
      { employee_id: 'NV1', date: '2026-10-22', shift_type: 'OFFICE_HOURS' },
    ] as WorkShift[];
    const totals = payrollAttendanceTotals(rows, shifts);
    expect(totals.get('NV1')).toBe(2);
    expect(totals.get('NV2')).toBe(0);
  });
});
