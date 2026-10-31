import { describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/config/database.js'
import { determinePunctuality, list } from '../../src/modules/attendance/attendance.service.js'

describe('attendance punctuality', () => {
  it('uses the assigned shift when formatting recorded events', async () => {
    vi.spyOn(prisma.attendance_logs, 'findMany').mockResolvedValueOnce([
      { id: 1n, employee_id: 'employee-1', event_time: new Date('2026-10-31T00:53:20Z'), type: 'CHECK_IN', employees: { id: 'employee-1', employee_code: 'NV-005' } },
    ] as any)
    vi.spyOn(prisma.employee_shifts, 'findMany').mockResolvedValueOnce([
      { employee_id: 'employee-1', work_date: new Date('2026-10-31T00:00:00Z'), start_time: null, end_time: null, shift_type: 'OFFICE_HOURS', work_shifts: { start_time: '08:00', end_time: '18:00' } },
    ] as any)
    const records = await list({}, { id: 'admin', role: 'ADMIN' })
    expect(records[0].punctuality).toBe('ON_TIME')
    vi.restoreAllMocks()
  })

  it('distinguishes late arrivals, early departures and missing shifts', () => {
    const shifts = [{ work_date: '2026-10-31', start_time: '08:00', end_time: '18:00', shift_type: 'OFFICE_HOURS' }]
    expect(determinePunctuality('CHECK_IN', '2026-10-31T08:16:00+07:00', shifts)).toBe('LATE')
    expect(determinePunctuality('CHECK_OUT', '2026-10-31T17:59:00+07:00', shifts)).toBe('EARLY_LEAVE')
    expect(determinePunctuality('CHECK_IN', '2026-10-31T07:53:20+07:00', [])).toBe('UNRECORDED')
  })
})
