import { describe, expect, it } from 'vitest'
import { calculateDay } from '../src/modules/attendance/attendance.policy.js'

const shift = { start_time: '08:00', end_time: '17:00', shift_type: 'OFFICE_HOURS' }
function calculate(date: string, out: string, assigned = shift) {
  return calculateDay(date, [
    { id: 1, type: 'CHECK_IN', event_time: `${date}T08:00:00+07:00`, status: 'VALID' },
    { id: 2, type: 'CHECK_OUT', event_time: `${date}T${out}+07:00`, status: 'VALID' },
  ], assigned, new Date(`${date}T23:59:59+07:00`))
}

describe('Two-thirds attendance policy effective 2026-10-29', () => {
  it('does not grant wages or a late/early penalty one second below six hours of a nine-hour shift', () => {
    const result = calculate('2026-10-29', '13:59:59')
    expect(result.workingHours).toBe(0)
    expect(result.lateEarlyHours).toBe(0)
    expect(result.overtimeCandidateHours).toBe(0)
    expect(result.requiresReview).toBe(true)
    expect(result.reviewReason).toContain('UNDER_MINIMUM_SHIFT')
    expect(result.absenceCandidate).toBe(false)
  })

  it('credits the full nine-hour shift exactly at six actual hours', () => {
    const result = calculate('2026-10-29', '14:00:00')
    expect(result.workingHours).toBe(9)
    expect(result.lateEarlyHours).toBe(3)
    expect(result.details.pairs[0].credited_regular_seconds).toBe(32400)
    expect(result.details.policy).toBe('2026-10-29-v6')
  })

  it('compares raw seconds before rounding for a four-hour shift', () => {
    const morning = { ...shift, end_time: '12:00' }
    expect(calculate('2026-10-29', '10:39:59', morning).workingHours).toBe(0)
    expect(calculate('2026-10-29', '10:40:00', morning).workingHours).toBe(4)
  })

  it('credits once at the checkout where multiple pairs jointly reach two thirds', () => {
    const date = '2026-10-29'
    const result = calculateDay(date, [
      { id: 1, type: 'CHECK_IN', event_time: `${date}T08:00:00+07:00` },
      { id: 2, type: 'CHECK_OUT', event_time: `${date}T13:00:00+07:00` },
      { id: 3, type: 'CHECK_IN', event_time: `${date}T14:00:00+07:00` },
      { id: 4, type: 'CHECK_OUT', event_time: `${date}T15:00:00+07:00` },
    ], shift)
    expect(result.workingHours).toBe(9)
    expect(result.details.pairs.map(pair => pair.credited_regular_seconds)).toEqual([0, 32400])
  })

  it('preserves the half-shift policy and credit placement before the effective date', () => {
    const result = calculate('2026-10-28', '12:30:00')
    expect(result.workingHours).toBe(9)
    expect(result.details.policy).toBe('2026-10-26-v5')
    expect(result.details.pairs[0].credited_regular_seconds).toBe(32400)
  })
})
