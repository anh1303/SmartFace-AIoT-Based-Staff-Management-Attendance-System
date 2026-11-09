import { expect, it } from 'vitest'
import { approvedAbsenceCount } from '../../src/modules/payroll/payroll.absence-count.js'

const day = (date: string) => new Date(`${date}T00:00:00Z`)
it('returns unknown when an elapsed working shift has no summary', () => {
  expect(approvedAbsenceCount([], [{ work_date: day('2026-10-01'), shift_type: 'OFFICE_HOURS' }], [], '2026-10-02')).toBeNull()
})
it('returns unknown for a current-day shift when completeness is checked through today', () => {
  expect(approvedAbsenceCount([], [{ work_date: day('2026-10-02'), shift_type: 'OFFICE_HOURS' }], [], '2026-10-03')).toBeNull()
})
it('ignores OFF and future shifts and counts only approved payroll adjustments', () => {
  const shifts = [{ work_date: day('2026-10-01'), shift_type: 'OFF' }, { work_date: day('2026-10-03'), shift_type: 'MORNING' }]
  expect(approvedAbsenceCount([{ kind: 'ABSENCE' }, { kind: 'OVERTIME' }], shifts, [], '2026-10-02')).toBe(1)
})
it('returns zero when all elapsed working shifts have summaries and there are no approved absences', () => {
  const date = day('2026-10-01')
  expect(approvedAbsenceCount([], [{ work_date: date, shift_type: 'MORNING' }], [{ work_date: date }], '2026-10-02')).toBe(0)
})
