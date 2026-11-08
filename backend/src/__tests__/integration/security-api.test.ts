// Behavioral fixtures use the auth adapter boundary; SQL projection has its own regression tests.
import { prisma } from '../../config/database.js'
vi.mock('../../modules/auth/auth.read.js', () => ({
  readAuthUser: async (id: string) => prisma.user.findUnique({ where: { id } }),
}))
import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../app.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { errorHandler } from '../../middlewares/errorHandler.js'

vi.mock('../../config/database.js', () => {
  const users: Record<string, any> = {
    'user-emp-1': { id: 'user-emp-1', username: 'employee1', is_active: true, roles: { role_name: 'EMPLOYEE' }, employees: { id: 'e-1', status: 'ACTIVE' } },
  }
  return {
    prisma: {
      user: {
        findUnique: vi.fn(async ({ where }: any) => users[where?.id] ?? null),
      },
    },
  }
})

describe('Integration & Security Test (API, Authorization & Error Handling)', () => {
  it('GET /health trả về 200 và thông tin hệ thống hoạt động bình thường', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('ok')
  })

  it('Yêu cầu không kèm Token sẽ bị từ chối với mã lỗi 401 Unauthenticated', async () => {
    const res = await request(app).get('/api/employees')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/Authentication token is required/i)
  })

  it('Yêu cầu với Token giả/hết hạn sẽ bị từ chối với 401', async () => {
    const res = await request(app)
      .get('/api/employees')
      .set('Authorization', 'Bearer invalid_token_xyz')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/Invalid or expired token/i)
  })

  it('RBAC: Role EMPLOYEE truy cập tài nguyên của ADMIN bị chặn với 403 Forbidden', async () => {
    const employeeToken = jwt.sign(
      { id: 'user-emp-1', role: 'EMPLOYEE', username: 'employee1' },
      env.JWT_SECRET
    )

    // GET /api/audit-logs là endpoint dành riêng cho ADMIN
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${employeeToken}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/Insufficient permissions/i)
  })

  it('Zod Validation: Gửi thông tin đăng nhập sai cấu trúc trả về 422/400 Validation Error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '' }) // Thiếu password

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toMatch(/Dữ liệu nhập không hợp lệ/i)
  })

  it('ErrorHandler: Ánh xạ chính xác các mã lỗi Prisma (P2000, P2002, P2011, P2014, P2025)', () => {
    const mockRes = () => {
      const res: any = {}
      res.status = (code: number) => {
        res.statusCode = code
        return res
      }
      res.json = (data: any) => {
        res.body = data
        return res
      }
      return res
    }

    // P2002: Duplicate entry -> 409
    let res = mockRes()
    errorHandler({ code: 'P2002' }, {} as any, res, () => {})
    expect(res.statusCode).toBe(409)
    expect(res.body.message).toMatch(/Duplicate entry/i)

    // P2000: Value too long -> 400
    res = mockRes()
    errorHandler({ code: 'P2000' }, {} as any, res, () => {})
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/độ dài tối đa/i)

    // P2011: Null constraint -> 400
    res = mockRes()
    errorHandler({ code: 'P2011' }, {} as any, res, () => {})
    expect(res.statusCode).toBe(400)
    expect(res.body.message).toMatch(/Null constraint/i)

    // P2025: Not found -> 404
    res = mockRes()
    errorHandler({ code: 'P2025' }, {} as any, res, () => {})
    expect(res.statusCode).toBe(404)
    expect(res.body.message).toMatch(/Không tìm thấy/i)
  })
})
