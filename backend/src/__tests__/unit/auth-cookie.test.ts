import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../app.js'
import * as authService from '../../modules/auth/auth.service.js'

vi.mock('../../modules/auth/auth.service.js', () => ({
  login: vi.fn(),
  me: vi.fn(),
  register: vi.fn(),
}))

describe('Unit & Security Test: Auth Cookie Behavior (auth-cookie.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockUser = {
    id: 'usr-123',
    username: 'admin_test',
    role: 'ADMIN',
    role_name: 'ADMIN',
    is_manager: true,
    employee_id: 'NV-001',
    employeeId: 'NV-001',
    full_name: 'Admin Test',
    email: 'admin@test.com',
    position: 'Manager',
    positionId: 1,
    department: 'IT',
    departmentId: 1,
    department_id: 1,
    avatar: '',
  }

  const mockToken = 'mocked.jwt.access.token.string'

  describe('1. POST /api/auth/login - Token Leakage & Cookie Security', () => {
    it('Đăng nhập thành công thiết lập Cookie "token" với thuộc tính HttpOnly', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: mockUser,
        accessToken: mockToken,
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'admin_test', password: 'Password123!' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // Kiểm tra Set-Cookie header có xuất hiện
      const rawCookies = res.headers['set-cookie']
      expect(rawCookies).toBeDefined()
      const cookies = Array.isArray(rawCookies) ? rawCookies : [String(rawCookies)]

      const tokenCookie = cookies.find((c) => c.startsWith('token='))
      expect(tokenCookie).toBeDefined()
      expect(tokenCookie).toContain(`token=${mockToken}`)

      // Kiểm tra thuộc tính bảo mật HttpOnly (chống XSS)
      expect(tokenCookie?.toLowerCase()).toContain('httponly')
      // Kiểm tra thuộc tính Path=/
      expect(tokenCookie?.toLowerCase()).toContain('path=/')
    })

    it('Response body đăng nhập KHÔNG leak token (chỉ chứa thông tin user trong JSON payload)', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: mockUser,
        accessToken: mockToken,
      })

      const res = await request(app)
        .post('/api/auth/login')
        .send({ identifier: 'admin_test', password: 'Password123!' })

      expect(res.status).toBe(200)

      // 1. Dữ liệu trả về có thông tin user
      expect(res.body.data.user).toBeDefined()
      expect(res.body.data.user.username).toBe('admin_test')

      // 2. Đảm bảo KHÔNG leak token trong JSON body (accessToken & token đều undefined)
      expect(res.body.data.token).toBeUndefined()
      expect(res.body.data.accessToken).toBeUndefined()

      // 3. Chuỗi token bí mật không bao giờ xuất hiện trong body text
      const bodyString = JSON.stringify(res.body)
      expect(bodyString).not.toContain(mockToken)
    })
  })

  describe('2. POST /api/auth/logout - Clear Cookie', () => {
    it('Đăng xuất thành công sẽ xóa sạch (clear) Cookie "token"', async () => {
      const res = await request(app).post('/api/auth/logout')

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toMatch(/Logged out/i)

      const rawCookies = res.headers['set-cookie']
      expect(rawCookies).toBeDefined()
      const cookies = Array.isArray(rawCookies) ? rawCookies : [String(rawCookies)]

      const tokenCookie = cookies.find((c) => c.startsWith('token='))
      expect(tokenCookie).toBeDefined()

      // Express res.clearCookie('token') đặt giá trị rỗng hoặc ngày hết hạn trong quá khứ (Epoch / Max-Age=0)
      const isCleared =
        tokenCookie?.includes('token=;') ||
        tokenCookie?.includes('Expires=Thu, 01 Jan 1970') ||
        tokenCookie?.includes('Max-Age=0')

      expect(isCleared).toBe(true)
    })
  })
})
