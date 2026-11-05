import { describe, expect, it } from 'vitest'
import { formatShift } from '../../src/modules/shifts/shift.service.js'

describe('shift display times', () => {
  it('uses assigned or catalog times and never invents office hours for missing values', () => {
    const base = { id: 1n, work_date: new Date('2026-01-01T00:00:00Z'), shift_type: 'OTHER' }
    expect(formatShift({ ...base, work_shifts: { start_time: '13:00', end_time: '17:00' } })).toMatchObject({ start_time: '13:00', end_time: '17:00' })
    expect(formatShift(base)).toMatchObject({ start_time: '', end_time: '' })
    expect(formatShift({ ...base, start_time: '09:30', end_time: '10:30', work_shifts: { start_time: '13:00', end_time: '17:00' } })).toMatchObject({ start_time: '09:30', end_time: '10:30' })
  })
})
