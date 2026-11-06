import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employee: { findMany: vi.fn() },
  employee_shifts: { findMany: vi.fn() },
  attendance_logs: { findMany: vi.fn() },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/modules/employees/public.js', async () => ({ ...(await import('../../src/modules/employees/employees.report-queries.js')), getEmployeeScope: vi.fn().mockResolvedValue({}) }))
vi.mock('../../src/modules/attendance/public.js', async () => {
  const { determinePunctuality } = await import('../../src/modules/attendance/attendance.format.js')
  return { determinePunctuality, ...(await import('../../src/modules/attendance/attendance.report-queries.js')) }
})
vi.mock('../../src/modules/shifts/public.js', async () => ({ ...(await import('../../src/modules/shifts/shifts.report-queries.js')), getActiveWorkShiftsCatalog: vi.fn().mockResolvedValue([]) }))

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


describe('dashboard punctuality from assigned shifts', () => {
  const log = (id: number, time: string, type = 'CHECK_IN', status = 'VALID') => ({
    id: BigInt(id), employee_id: '1', type, status,
    event_time: new Date(`2026-11-06T${time}+07:00`),
  })

  beforeEach(() => {
    db.employee.findMany.mockResolvedValue([{ id: '1', employee_code: 'E1', full_name: 'One', department: null }])
    db.employee_shifts.findMany.mockResolvedValue([{
      employee_id: '1', work_date: new Date('2026-11-06T00:00:00Z'),
      shift_type: 'OFFICE_HOURS', start_time: null, end_time: null,
      work_shifts: { start_time: '08:00', end_time: '17:00' },
    }])
  })

  it('labels valid late arrivals and early departures using shift times', async () => {
    db.attendance_logs.findMany.mockResolvedValue([log(2, '11:40:18', 'CHECK_OUT'), log(1, '10:18:43')])
    const result = await getTodayDashboard()
    expect(result.recentLogs.map(l => l.statusInfo.label)).toEqual(['Về sớm', 'Đi muộn'])
    expect(result.recentLogs.map(l => l.status)).toEqual(['VALID', 'VALID'])
  })

  it('counts early departure once even after an on-time arrival and later re-entry', async () => {
    db.attendance_logs.findMany.mockResolvedValue([log(3, '13:00:00'), log(2, '11:40:18', 'CHECK_OUT'), log(1, '08:00:00')])
    const result = await getTodayDashboard()
    expect(result.punctuality).toMatchObject({ onTimeCount: 0, lateCount: 1, notCheckedInCount: 0, latePct: 100 })
  })

  it('preserves invalid and flagged labels rather than claiming punctuality', async () => {
    db.attendance_logs.findMany.mockResolvedValue([log(2, '11:40:18', 'CHECK_OUT', 'INVALID'), log(1, '10:18:43', 'CHECK_IN', 'FLAGGED')])
    const result = await getTodayDashboard()
    expect(result.recentLogs.map(l => l.statusInfo.label)).toEqual(['Không hợp lệ', 'Cần xác minh'])
  })

  it('does not label unscheduled events as on time', async () => {
    db.employee_shifts.findMany.mockResolvedValue([])
    db.attendance_logs.findMany.mockResolvedValue([log(1, '08:00:00')])
    const result = await getTodayDashboard()
    expect(result.recentLogs[0].statusInfo.label).toBe('Chưa ghi nhận')
  })
})
