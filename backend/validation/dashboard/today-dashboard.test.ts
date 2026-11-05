import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employee: { findMany: vi.fn() },
  employee_shifts: { findMany: vi.fn() },
  attendance_logs: { findMany: vi.fn() },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/modules/employees/public.js', () => ({ getEmployeeScope: vi.fn().mockResolvedValue({}) }))
vi.mock('../../src/modules/attendance/public.js', () => ({ determinePunctuality: vi.fn().mockReturnValue('ON_TIME') }))
vi.mock('../../src/modules/shifts/public.js', () => ({ getActiveWorkShiftsCatalog: vi.fn().mockResolvedValue([]) }))

import { getTodayDashboard } from '../../src/modules/dashboard/dashboard.service.js'

describe('today dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.employee.findMany.mockResolvedValue([
      { id: '1', employee_code: 'E1', full_name: 'One', department: null },
      { id: '2', employee_code: 'E2', full_name: 'Two', department: null },
    ])
    db.employee_shifts.findMany.mockResolvedValue([])
    db.attendance_logs.findMany.mockResolvedValue([])
  })

  it('does not invent scheduled staff or shifts when no assignments exist', async () => {
    const result = await getTodayDashboard()
    expect(result.kpis).toMatchObject({ workingEmployeesCount: 0, totalEmployees: 2, checkInCount: 0 })
    expect(result.shifts).toEqual([])
    expect(result.punctuality).toMatchObject({ notCheckedInCount: 0, notCheckedInPct: 0 })
  })

  it('counts unique scheduled employees and keeps assigned shifts', async () => {
    db.employee_shifts.findMany.mockResolvedValue([
      { employee_id: '1', shift_type: 'MORNING', start_time: null, end_time: null, work_shifts: null },
      { employee_id: '1', shift_type: 'AFTERNOON', start_time: null, end_time: null, work_shifts: null },
    ])
    const result = await getTodayDashboard()
    expect(result.kpis.workingEmployeesCount).toBe(1)
    expect(result.shifts).toHaveLength(2)
    expect(result.punctuality.notCheckedInCount).toBe(1)
  })

  it('does not count an unscheduled check-in as attendance for a scheduled employee', async () => {
    db.employee_shifts.findMany.mockResolvedValue([
      { employee_id: '1', shift_type: 'MORNING', start_time: null, end_time: null, work_shifts: null },
    ])
    db.attendance_logs.findMany.mockResolvedValue([
      { employee_id: '2', type: 'CHECK_IN', status: 'VALID', event_time: new Date(), id: 1n },
    ])
    const result = await getTodayDashboard()
    expect(result.kpis.checkInCount).toBe(1)
    expect(result.punctuality.notCheckedInCount).toBe(1)
  })
})
