import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../../src/config/database.js', () => ({ prisma: {
  employee: { findMany: vi.fn() }, employee_shifts: { findMany: vi.fn() }, attendance_logs: { findMany: vi.fn() },
} }))
vi.mock('../../src/modules/employees/public.js', () => ({ getEmployeeScope: vi.fn(async () => ({})) }))
vi.mock('../../src/modules/shifts/public.js', () => ({ getActiveWorkShiftsCatalog: vi.fn(async () => []) }))
vi.mock('../../src/modules/attendance/public.js', async () => ({ determinePunctuality: (await import('../../src/modules/attendance/attendance.format.js')).determinePunctuality }))
import { prisma } from '../../src/config/database.js'
import { getTodayDashboard } from '../../src/modules/dashboard/dashboard.service.js'

afterEach(() => vi.useRealTimers())
it('counts first valid arrivals once and separates punctuality from log validity', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-02T14:00:00+07:00'))
  const ids = ['employee-a', 'employee-b', 'employee-c']
  vi.mocked(prisma.employee.findMany).mockResolvedValue(ids.map(id => ({ id, employee_code: id, full_name: id, department: { name: 'QA' } })) as any)
  vi.mocked(prisma.employee_shifts.findMany).mockResolvedValue(ids.map(employee_id => ({ employee_id, work_date: new Date('2026-11-02'), shift_type: 'OFFICE_HOURS', start_time: new Date('1970-01-01T08:00:00Z'), end_time: new Date('1970-01-01T17:00:00Z'), work_shifts: {} })) as any)
  const punch = (employee_id: string, time: string, status = 'VALID') => ({ id: `${employee_id}-${time}`, employee_id, type: 'CHECK_IN', event_time: new Date(`2026-11-02T${time}+07:00`), status })
  vi.mocked(prisma.attendance_logs.findMany).mockResolvedValue([
    punch(ids[0], '13:00:00'), punch(ids[1], '08:30:00'), punch(ids[0], '08:00:00'), punch(ids[2], '07:55:00', 'FLAGGED'),
  ] as any)
  const result = await getTodayDashboard()
  expect(result.kpis.checkInCount).toBe(2)
  expect(result.punctuality).toMatchObject({ onTimeCount: 1, lateCount: 1, notCheckedInCount: 1 })
})
