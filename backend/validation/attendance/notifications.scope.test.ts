import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

const mocks = vi.hoisted(() => ({
  user: vi.fn(), scope: vi.fn(), list: vi.fn(), update: vi.fn(),
}))
vi.mock('../../src/config/database.js', () => ({ prisma: {
  user: { findUnique: mocks.user },
  systemNotification: { findMany: mocks.list, updateMany: mocks.update },
} }))
vi.mock('../../src/middlewares/auth.middleware.js', () => ({ authenticate: (req: any, _res: any, next: any) => { req.user = { id: 'u1' }; next() } }))
vi.mock('../../src/modules/employees/employee.permission.js', () => ({ getEmployeeScope: mocks.scope }))
import { notificationRouter } from '../../src/modules/attendance/attendance.notifications.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'

const app = express()
app.use(express.json(), notificationRouter, errorHandler)
beforeEach(() => {
  vi.clearAllMocks()
  mocks.user.mockResolvedValue({ is_active: true, roles: { role_name: 'MANAGER' } })
  mocks.scope.mockResolvedValue({ departmentId: 7 })
  mocks.update.mockResolvedValue({ count: 0 })
})
describe('notification ownership', () => {
  it('scopes reads to the current user and employee visibility', async () => {
    mocks.list.mockResolvedValue([])
    expect((await request(app).get('/')).status).toBe(200)
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: 'u1', deleted_at: null, employee: { is: { departmentId: 7 } } } }))
  })
  it('does not allow updating another user notification', async () => {
    expect((await request(app).patch('/42').send({ action: 'read' })).status).toBe(404)
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [{ user_id: 'u1', deleted_at: null, employee: { is: { departmentId: 7 } } }, { id: 42n }] } }))
  })
})
