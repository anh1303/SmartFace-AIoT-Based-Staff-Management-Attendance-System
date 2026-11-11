import { afterEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '../../src/config/database.js'
import { formatAttendanceRecords } from '../../src/modules/attendance/attendance.format.js'

afterEach(() => vi.restoreAllMocks())

describe('formatting a committed edge scan using the transaction schedule', () => {
  const log = { id: 1n, employee_id: 'employee-1', event_time: new Date('2026-11-01T05:30:00+07:00'), type: 'CHECK_OUT' }
  const shifts: any[] = [
    { employee_id: 'employee-1', work_date: new Date('2026-10-31'), start_time: null, end_time: null, shift_type: 'OTHER', work_shifts: { start_time: '22:00', end_time: '06:00' } },
    { employee_id: 'employee-1', work_date: new Date('2026-11-01'), start_time: '22:00', end_time: '06:00', shift_type: 'OTHER', work_shifts: {} },
    { employee_id: 'employee-1', work_date: new Date('2026-11-02'), start_time: '22:00', end_time: '06:00', shift_type: 'OTHER', work_shifts: {} },
  ]

  it('preserves overnight punctuality and the response without rereading shifts', async () => {
    const read = vi.spyOn(prisma.employee_shifts, 'findMany').mockResolvedValue(shifts.slice(0, 2))
    const baseline = await formatAttendanceRecords([log])
    read.mockClear()
    const cached = await formatAttendanceRecords([log], shifts)
    expect(cached).toEqual(baseline)
    expect(cached[0].punctuality).toBe('EARLY_LEAVE')
    expect(read).not.toHaveBeenCalled()
  })

  it('treats an empty schedule as known empty instead of issuing another query', async () => {
    const read = vi.spyOn(prisma.employee_shifts, 'findMany')
    const result = await formatAttendanceRecords([log], [])
    expect(result[0].punctuality).toBe('UNRECORDED')
    expect(read).not.toHaveBeenCalled()
  })
})
