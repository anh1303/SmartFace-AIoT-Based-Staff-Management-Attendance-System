import { describe, expect, it } from 'vitest';
import { calculateMonthlyAverages } from '../src/features/employees/utils/monthlyAverages';

describe('employee monthly averages', () => {
  it('averages monthly totals and monthly punctuality rates, including zero values', () => {
    const result = calculateMonthlyAverages(
      [{ date: '2026-01-01', shift_type: 'OFFICE_HOURS' }, { date: '2026-01-02', shift_type: 'OFF' }, { date: '2026-02-01', shift_type: 'OFFICE_HOURS' }, { date: '2026-02-02', shift_type: 'OTHER' }, { date: '2026-03-01', shift_type: 'OFFICE_HOURS' }],
      [{ date: '2026-01-01', status: 'PRESENT', total_working_hours: 8, overtime: 2, late_early: 0 }, { date: '2026-01-02', status: 'LATE', total_working_hours: 4, overtime: 0, late_early: 1 }, { date: '2026-02-01', status: 'PRESENT', total_working_hours: 6, overtime: 0, late_early: 0 }, { date: '2026-02-02', status: 'ABSENT', is_absent: true, total_working_hours: 0, overtime: 0, late_early: 0 }],
      [{ period: '2026-01', net_salary: 100 }, { period: '2026-02', net_salary: 0 }], '2026-02'
    );
    expect(result).toEqual({ shifts: 1.5, hours: 9, punctuality: 75, overtime: 1, lateEarly: 0.5, absence: 0.5, salary: 50 });
  });
  it('returns missing values when there is no usable data', () => {
    expect(calculateMonthlyAverages([], [], [], '2026-02')).toEqual({ shifts: null, hours: null, punctuality: null, overtime: null, lateEarly: null, absence: null, salary: null });
  });
});
