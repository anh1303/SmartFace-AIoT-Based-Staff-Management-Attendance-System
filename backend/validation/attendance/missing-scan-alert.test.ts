import { describe, expect, it } from 'vitest'
import { missingScanKind } from '../../src/modules/attendance/attendance.missing-alerts.js'

const shift = { work_date: new Date('2026-10-30T00:00:00Z'), shift_type: 'OFFICE_HOURS', start_time: '08:00', end_time: '17:00' }
const event = (type: string, status = 'VALID') => ({ type, status })

describe('Missing attendance after a shift', () => {
  it('waits until 30 minutes after shift end and identifies the missing event', () => {
    const before = new Date('2026-10-30T17:29:59+07:00')
    const due = new Date('2026-10-30T17:30:00+07:00')
    expect(missingScanKind(shift, [], before)).toBeNull()
    expect(missingScanKind(shift, [], due)).toBe('BOTH')
    expect(missingScanKind(shift, [event('CHECK_IN')], due)).toBe('CHECK_OUT')
    expect(missingScanKind(shift, [event('CHECK_OUT')], due)).toBe('CHECK_IN')
    expect(missingScanKind(shift, [event('CHECK_IN'), event('CHECK_OUT')], due)).toBeNull()
    expect(missingScanKind(shift, [event('CHECK_IN', 'FLAGGED')], due)).toBe('BOTH')
  })
  it('uses the end of an overnight shift and skips OFF and zero-length shifts', () => {
    const night = { ...shift, start_time: '22:00', end_time: '06:00' }
    expect(missingScanKind(night, [], new Date('2026-10-31T06:29:59+07:00'))).toBeNull()
    expect(missingScanKind(night, [], new Date('2026-10-31T06:30:00+07:00'))).toBe('BOTH')
    expect(missingScanKind({ ...shift, shift_type: 'OFF' }, [], new Date('2026-10-31T12:00:00+07:00'))).toBeNull()
    expect(missingScanKind({ ...shift, start_time: '08:00', end_time: '08:00' }, [], new Date('2026-10-31T12:00:00+07:00'))).toBeNull()
  })
})
