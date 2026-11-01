import { describe, expect, it, vi } from 'vitest'
const findFirst = vi.hoisted(() => vi.fn())
vi.mock('../../src/config/database.js', () => ({ prisma: { employee: { findFirst } } }))
import { attendanceRecipientRooms } from '../../src/modules/attendance/attendance.recipients.js'

describe('attendance event recipients', () => {
  it('limits manager events to the individual and administrators', async () => {
    findFirst.mockResolvedValue({ id: 'employee-1', user_id: 'user-1', departmentId: 12, position: { level: 'MANAGER' } })
    expect(await attendanceRecipientRooms({ employee_id: 'employee-1' })).toEqual(['ADMIN', 'employee:employee-1', 'user:user-1'])
  })
  it('includes the department for a non-manager employee', async () => {
    findFirst.mockResolvedValue({ id: 'employee-2', user_id: 'user-2', departmentId: 12, position: { level: 'STAFF' } })
    expect(await attendanceRecipientRooms({ employee_id: 'employee-2' })).toEqual(['ADMIN', 'department:12', 'employee:employee-2', 'user:user-2'])
  })
})
