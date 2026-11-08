// Behavioral fixtures use the auth adapter boundary; SQL projection has its own regression tests.
import { prisma } from '../../config/database.js'
vi.mock('../../modules/auth/auth.read.js', () => ({
  readAuthUser: async (id: string) => prisma.user.findUnique({ where: { id } }),
}))
import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../app.js'
import { env } from '../../config/env.js'
import * as deviceService from '../../modules/devices/device.service.js'
import { vi } from 'vitest'

vi.mock('../../config/database.js', () => {
  const users: Record<string, any> = {
    'admin-1': { id: 'admin-1', username: 'admin', is_active: true, roles: { role_name: 'ADMIN' }, employees: { id: 'e-1', status: 'ACTIVE' } },
  }
  return {
    prisma: {
      user: {
        findUnique: vi.fn(async ({ where }: any) => users[where?.id] ?? null),
      },
      device: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
    },
  }
})

describe('Unit Test: Device Mode Synchronization (Pi ↔ Backend ↔ Web App)', () => {
  beforeEach(() => {
    // Reset any state if needed
  })

  const adminToken = jwt.sign(
    { id: 'admin-1', role: 'ADMIN', username: 'admin' },
    env.JWT_SECRET
  )

  it('1. GET /api/devices/:id/mode: Ban đầu chưa nhận được xác nhận từ Pi -> confirmed: false', async () => {
    const res = await request(app)
      .get('/api/devices/TEST_PI_01/mode')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.deviceId).toBe('TEST_PI_01')
    expect(res.body.data.confirmed).toBe(false)
  })

  it('2. POST /api/devices/:id/mode-notify: Khi Pi thông báo chế độ phần cứng -> backend ghi nhận confirmed: true', async () => {
    const notifyRes = await request(app)
      .post('/api/devices/TEST_PI_01/mode-notify')
      .set('X-TB-Webhook-Secret', process.env.TB_WEBHOOK_SECRET || '')
      .send({ mode: 'CHECK_OUT' })

    expect(notifyRes.status).toBe(200)
    expect(notifyRes.body.success).toBe(true)
    expect(notifyRes.body.data.mode).toBe('CHECK_OUT')
    expect(notifyRes.body.data.confirmed).toBe(true)

    // Đọc lại mode từ GET endpoint
    const getRes = await request(app)
      .get('/api/devices/TEST_PI_01/mode')
      .set('Authorization', `Bearer ${adminToken}`)

    expect(getRes.status).toBe(200)
    expect(getRes.body.data.mode).toBe('CHECK_OUT')
    expect(getRes.body.data.confirmed).toBe(true)
  })

  it('3. PATCH /api/devices/:id/mode: Đồng bộ mode qua PATCH endpoint, phản hồi kết quả và trạng thái ACK', async () => {
    // Kích hoạt mode-notify giả lập Pi phản hồi ngay sau khi gửi lệnh PATCH
    setTimeout(() => {
      deviceService.recordDeviceModeNotify('TEST_PI_02', 'CHECK_IN')
    }, 50)

    const patchRes = await request(app)
      .patch('/api/devices/TEST_PI_02/mode')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mode: 'CHECK_IN' })

    expect(patchRes.status).toBe(200)
    expect(patchRes.body.success).toBe(true)
    expect(patchRes.body.data.mode).toBe('CHECK_IN')
    expect(patchRes.body.data.confirmed).toBe(true)
  })
})
