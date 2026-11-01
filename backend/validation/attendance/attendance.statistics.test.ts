import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  employee: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  attendance_logs: { groupBy: vi.fn() },
  user: { findUnique: vi.fn() },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))

import { statistics } from '../../src/modules/attendance/attendance.service.js'
import { countScopedEmployees } from '../../src/modules/employees/employee.queries.js'

describe('Attendance statistics by role scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.attendance_logs.groupBy.mockResolvedValue([{ employee_id: 'emp-1' }])
    db.employee.count.mockResolvedValue(10)
  })

  it('queries statistics for ADMIN with full company scope and status: ACTIVE', async () => {
    const admin = { id: 'admin-user', role: 'ADMIN' }
    const res = await statistics(admin)

    expect(res).toEqual({
      date: expect.any(String),
      checkedIn: 1,
      totalEmployees: 10,
      absent: 9,
    })
    expect(db.attendance_logs.groupBy).toHaveBeenCalledWith({
      by: ['employee_id'],
      where: expect.objectContaining({
        employees: {},
        type: 'CHECK_IN',
      }),
    })
    expect(db.employee.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
    })
  })

  it('queries statistics for MANAGER scoped to managed employees and status: ACTIVE', async () => {
    // Setup manager and employees
    db.employee.findFirst.mockResolvedValueOnce({
      id: 'mgr-emp',
      user_id: 'mgr-user',
      departmentId: 1,
      status: 'ACTIVE',
    })
    db.employee.findMany.mockResolvedValueOnce([
      { id: 'mgr-emp', departmentId: 1, users: null, position: null },
      { id: 'staff-emp', departmentId: 1, users: null, position: null },
    ])

    const manager = { id: 'mgr-user', role: 'MANAGER' }
    const res = await statistics(manager)

    expect(res.checkedIn).toBe(1)
    expect(res.totalEmployees).toBe(10)
    expect(db.employee.count).toHaveBeenCalledWith({
      where: {
        AND: [
          { id: { in: expect.arrayContaining(['mgr-emp', 'staff-emp']) } },
          { status: 'ACTIVE' },
        ],
      },
    })
  })

  it('queries countScopedEmployees with numeric department ID correctly', async () => {
    db.employee.count.mockResolvedValueOnce(5)
    const count = await countScopedEmployees(3)
    expect(count).toBe(5)
    expect(db.employee.count).toHaveBeenCalledWith({
      where: {
        AND: [
          { departmentId: 3 },
          { status: 'ACTIVE' },
        ],
      },
    })
  })
})
