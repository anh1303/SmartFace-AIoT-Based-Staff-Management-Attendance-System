// Behavioral fixtures use the auth adapter boundary; SQL projection has its own regression tests.
import { prisma } from '../../config/database.js'
vi.mock('../../modules/auth/auth.read.js', () => ({
  readAuthUser: async (id: string) => prisma.user.findUnique({ where: { id } }),
}))
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../app.js'
import { env } from '../../config/env.js'
import * as attendanceService from '../../modules/attendance/attendance.service.js'

vi.mock('../../modules/attendance/attendance.service.js', () => ({
  toggleLock: vi.fn(),
  getLocks: vi.fn(),
  list: vi.fn(),
  statistics: vi.fn(),
  checkIn: vi.fn(),
  checkOut: vi.fn(),
  adjustAttendance: vi.fn(),
  getDailySummaries: vi.fn(),
}))

vi.mock('../../config/database.js', () => {
  const users: Record<string, any> = {
    'admin-1': { id: 'admin-1', username: 'admin', is_active: true, roles: { role_name: 'ADMIN' }, employees: { id: 'e-1', status: 'ACTIVE' } },
    'mgr-1': { id: 'mgr-1', username: 'manager', is_active: true, roles: { role_name: 'MANAGER' }, employees: { id: 'e-2', status: 'ACTIVE' } },
    'emp-1': { id: 'emp-1', username: 'employee1', is_active: true, roles: { role_name: 'EMPLOYEE' }, employees: { id: 'e-3', status: 'ACTIVE' } },
  }
  return {
    prisma: {
      user: {
        findUnique: vi.fn(async ({ where }: any) => users[where?.id] ?? null),
      },
    },
  }
})

describe('Unit & Security Test: Attendance Lock (attendance-lock.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const adminToken = jwt.sign(
    { id: 'admin-1', role: 'ADMIN', username: 'admin' },
    env.JWT_SECRET
  )

  const managerToken = jwt.sign(
    { id: 'mgr-1', role: 'MANAGER', username: 'manager' },
    env.JWT_SECRET
  )

  const employeeToken = jwt.sign(
    { id: 'emp-1', role: 'EMPLOYEE', username: 'employee1' },
    env.JWT_SECRET
  )

  describe('1. Lock & Unlock Operations', () => {
    it('ADMIN khóa ngày chấm công thành công (/api/attendance/locks/lock)', async () => {
      const mockLockResult = {
        date: '2026-09-25',
        is_locked: true,
        locked_at: new Date(),
        locked_by: 'admin-1',
      }
      vi.mocked(attendanceService.toggleLock).mockResolvedValue(mockLockResult)

      const res = await request(app)
        .post('/api/attendance/locks/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: '2026-09-25' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.is_locked).toBe(true)
      expect(attendanceService.toggleLock).toHaveBeenCalledWith('2026-09-25', true, 'admin-1', 'ADMIN')
    })

    it('MANAGER cannot unlock a global attendance date', async () => {
      const res = await request(app)
        .post('/api/attendance/locks/unlock')
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ date: '2026-09-25' })
      expect(res.status).toBe(403)
      expect(attendanceService.toggleLock).not.toHaveBeenCalled()
    })
  })

  describe('2. Idempotency & Duplicate Lock Operations', () => {
    it('Khóa cùng một ngày 2 lần liên tiếp không gây lỗi trùng lặp (Upsert / Idempotent)', async () => {
      const mockLockResult = {
        date: '2026-09-25',
        is_locked: true,
        locked_at: new Date(),
        locked_by: 'admin-1',
      }
      vi.mocked(attendanceService.toggleLock).mockResolvedValue(mockLockResult)

      const res1 = await request(app)
        .post('/api/attendance/locks/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: '2026-09-25' })

      const res2 = await request(app)
        .post('/api/attendance/locks/lock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ date: '2026-09-25' })

      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)
      expect(res1.body.data.is_locked).toBe(true)
      expect(res2.body.data.is_locked).toBe(true)
      expect(attendanceService.toggleLock).toHaveBeenCalledTimes(2)
    })
  })

  describe('3. RBAC Enforcement on Lock/Unlock', () => {
    it('EMPLOYEE thực hiện khóa ngày bị từ chối với mã lỗi 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/attendance/locks/lock')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ date: '2026-09-25' })

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/Insufficient permissions/i)
      expect(attendanceService.toggleLock).not.toHaveBeenCalled()
    })

    it('EMPLOYEE thực hiện mở khóa ngày bị từ chối với mã lỗi 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/attendance/locks/unlock')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ date: '2026-09-25' })

      expect(res.status).toBe(403)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toMatch(/Insufficient permissions/i)
      expect(attendanceService.toggleLock).not.toHaveBeenCalled()
    })
  })
})
