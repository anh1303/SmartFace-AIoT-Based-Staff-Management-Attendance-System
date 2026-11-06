import { describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employee: { findMany: vi.fn() }, department: { findMany: vi.fn() },
  attendance_logs: { findMany: vi.fn() }, daily_attendance_summary: { findMany: vi.fn() },
  employee_shifts: { findMany: vi.fn() }, payrollRecord: { findMany: vi.fn() },
}))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/modules/employees/public.js', async () => ({ ...(await import('../../src/modules/employees/employees.report-queries.js')), getEmployeeScope: vi.fn().mockResolvedValue({}) }))
import { getMonthlyReport } from '../../src/modules/reports/reports.service.js'

describe('monthly report data', () => {
  it('calculates daily punctuality from classified workdays, not valid biometric punches', async () => {
    db.employee.findMany.mockResolvedValue([{ id: '1', employee_code: 'E1', full_name: 'One', department: null }])
    db.department.findMany.mockResolvedValue([])
    db.attendance_logs.findMany.mockResolvedValue([{ employee_id: '1', method: 'FACE', status: 'VALID', event_time: new Date('2026-01-01T04:00:00Z') }])
    db.daily_attendance_summary.findMany.mockResolvedValue([
      { employee_id: '1', work_date: new Date('2026-01-01T00:00:00Z'), attendance_status: 'PRESENT' },
      { employee_id: '2', work_date: new Date('2026-01-01T00:00:00Z'), attendance_status: 'LATE' },
      { employee_id: '3', work_date: new Date('2026-01-01T00:00:00Z'), attendance_status: 'INCOMPLETE' },
      { employee_id: '4', work_date: new Date('2026-01-02T00:00:00Z'), attendance_status: 'EARLY_LEAVE' },
    ])
    db.employee_shifts.findMany.mockResolvedValue([])
    db.payrollRecord.findMany.mockResolvedValue([])
    const report = await getMonthlyReport('2026-01')
    expect(db.attendance_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employee_id: { in: ['1'] }, event_time: { gte: new Date('2026-01-01T00:00:00+07:00'), lte: new Date('2026-01-31T23:59:59.999+07:00') } },
    }))
    expect(db.payrollRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { employeeId: { in: ['1'] }, payroll_period: '2026-01' },
    }))
    expect(report.dailyPunctuality[0]).toEqual({ day: '01', total: 2, onTime: 1, rate: 50 })
    expect(report.dailyPunctuality[1]).toEqual({ day: '02', total: 1, onTime: 1, rate: 100 })
    expect(report.dailyPunctuality[2]).toEqual({ day: '03', total: 0, onTime: 0, rate: undefined })
  })
  it('does not create salaries, absences, periods or confidence scores when data is missing', async () => {
    db.employee.findMany.mockResolvedValue([{ id: '1', employee_code: 'E1', full_name: 'One', department: null, hourly_rate: 50000 }])
    db.department.findMany.mockResolvedValue([])
    db.attendance_logs.findMany.mockResolvedValue([{ employee_id: '1', method: 'FACE', verification_score: null, status: 'VALID', event_time: new Date('2026-01-01T04:00:00Z') }])
    db.daily_attendance_summary.findMany.mockResolvedValue([])
    db.employee_shifts.findMany.mockResolvedValue([{ employee_id: '1', work_date: new Date('2026-01-02T00:00:00Z') }])
    db.payrollRecord.findMany.mockResolvedValue([])
    const report = await getMonthlyReport('2026-01')
    expect(report.availablePeriods).toEqual(['2026-01'])
    expect(report.summary).toMatchObject({ departmentCount: 0, totalSalary: 0, unexcusedAbsenceCount: 0 })
    expect(report.leaderboard[0].salary).toBeNull()
    expect(report.biometrics.face).toMatchObject({ totalCount: 1, tierGt95: 0, tierMid: 0, tierLt80: 0 })
  })

  it('preserves zero when a payroll record exists with zero net salary', async () => {
    db.payrollRecord.findMany.mockResolvedValueOnce([{ employeeId: '1', net_salary: 0 }]).mockResolvedValueOnce([])
    const report = await getMonthlyReport('2026-01')
    expect(report.leaderboard[0].salary).toBe(0)
  })
})
