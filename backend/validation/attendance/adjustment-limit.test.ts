import { describe, expect, it } from 'vitest'
import { adjustAttendanceSchema } from '../../src/modules/attendance/attendance.dto.js'

describe('manual overtime limit', () => {
  const input = { employeeId: 'employee', date: '2026-10-20', late_early: 0, reason: 'Verified' }
  it('accepts four hours and rejects more than four hours', () => {
    expect(adjustAttendanceSchema.safeParse({ ...input, overtime: 4 }).success).toBe(true)
    expect(adjustAttendanceSchema.safeParse({ ...input, overtime: 4.01 }).success).toBe(false)
  })
})
