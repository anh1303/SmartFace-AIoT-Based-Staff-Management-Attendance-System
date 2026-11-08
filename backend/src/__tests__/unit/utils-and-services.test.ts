import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { buildIdOrCodeWhere, formatVNDateISO, generateRandomPassword } from '../../common/utils.js'
import { sendAccountCredentialsEmail } from '../../common/email.service.js'
import { successResponse } from '../../common/response.js'
import { validate } from '../../middlewares/validate.middleware.js'
import { determinePunctuality } from '../../modules/attendance/attendance.service.js'
import { createMqttDeviceSignature, verifyMqttDeviceSignature } from '../../modules/devices/device.mqtt.handler.js'
import { ATTENDANCE_PUNCTUALITY } from '../../common/constants.js'
import { Logger } from '../../common/logger.js'

describe('Unit Test: Common Utils, Serialization, Validate Middleware & Services', () => {

  describe('1. common/utils.ts', () => {
    it('buildIdOrCodeWhere phân biệt chính xác giữa UUID và employee_code', () => {
      const uuidStr = '123e4567-e89b-12d3-a456-426614174000'
      const codeStr = 'NV-001'

      expect(buildIdOrCodeWhere(uuidStr)).toEqual({ id: uuidStr })
      expect(buildIdOrCodeWhere(codeStr)).toEqual({ employee_code: codeStr })
    })

    it('formatVNDateISO định dạng ngày chuẩn YYYY-MM-DD theo Múi giờ Việt Nam (+07:00)', () => {
      // 2026-09-25T17:00:00Z tương ứng 2026-09-26T00:00:00+07:00 ở Việt Nam
      const dateUtc = new Date('2026-09-25T17:00:00Z')
      const formatted = formatVNDateISO(dateUtc)
      expect(formatted).toBe('2026-09-26')
    })
  })

  describe('2. common/response.ts (serializeBigInt)', () => {
    it('serializeBigInt chuyển đổi BigInt, Buffer, Map, Set và phòng chống vỡ stack do Circular Reference', () => {
      const mockRes = () => {
        const res: any = {}
        res.status = (code: number) => { res.statusCode = code; return res }
        res.json = (data: any) => { res.body = data; return res }
        return res
      }

      const circularObj: any = { name: 'Test' }
      circularObj.self = circularObj

      const testData = {
        bigIntValue: BigInt(9007199254740991),
        bufferValue: Buffer.from('hello'),
        mapValue: new Map([['key1', 'val1']]),
        setValue: new Set([1, 2, 3]),
        circular: circularObj,
      }

      const res = mockRes()
      successResponse(res, testData)

      expect(res.body.success).toBe(true)
      expect(res.body.data.bigIntValue).toBe('9007199254740991')
      expect(res.body.data.bufferValue).toBe('aGVsbG8=')
      expect(res.body.data.mapValue).toEqual({ key1: 'val1' })
      expect(res.body.data.setValue).toEqual([1, 2, 3])
      expect(res.body.data.circular.self).toBe('[Circular]')
    })
  })

  describe('3. validate.middleware.ts', () => {
    it('validate middleware hỗ trợ kết hợp body, query, params trong 1 schema target', () => {
      const middleware = validate({
        body: z.object({ name: z.string().min(1) }),
        query: z.object({ page: z.string().transform(Number) }),
        params: z.object({ id: z.string().uuid() }),
      })

      const req: any = {
        body: { name: 'NV A' },
        query: { page: '2' },
        params: { id: '123e4567-e89b-12d3-a456-426614174000' },
      }

      let nextCalled = false
      middleware(req, {} as any, () => { nextCalled = true })

      expect(nextCalled).toBe(true)
      expect(req.query.page).toBe(2)
      expect(req.body.name).toBe('NV A')
    })
  })

  describe('4. attendance.service.ts (determinePunctuality & Grace Period)', () => {
    const mockShift = [
      {
        work_date: '2026-09-25',
        start_time: '08:00',
        end_time: '17:30',
      },
    ]

    it('Điểm danh Check-In trong khoảng ân hạn 15 phút (Grace Period) tính là ON_TIME', () => {
      // Shift bắt đầu lúc 08:00 (+07:00). Check-in 08:14:00 (trong vòng 15p)
      const eventTime = new Date('2026-09-25T08:14:00+07:00')
      const status = determinePunctuality('CHECK_IN', eventTime, mockShift)
      expect(status).toBe(ATTENDANCE_PUNCTUALITY.ON_TIME)
    })

    it('Điểm danh Check-In sau 15 phút (từ 08:15:01 trở đi) bị tính là LATE', () => {
      const eventTime = new Date('2026-09-25T08:16:00+07:00')
      const status = determinePunctuality('CHECK_IN', eventTime, mockShift)
      expect(status).toBe(ATTENDANCE_PUNCTUALITY.LATE)
    })

    it('Check-out trước giờ kết thúc ca (trước 17:30) bị tính là EARLY_LEAVE', () => {
      const eventTime = new Date('2026-09-25T17:25:00+07:00')
      const status = determinePunctuality('CHECK_OUT', eventTime, mockShift)
      expect(status).toBe(ATTENDANCE_PUNCTUALITY.EARLY_LEAVE)
    })
  })

  describe('5. device.mqtt.handler.ts (verifyMqttDeviceSignature & Replay Attack)', () => {
    it('Xác thực chữ ký HMAC SHA-256 thành công cho thiết bị hợp lệ', () => {
      const deviceId = 'DEV-001'
      const employeeId = 'NV-100'
      const timestamp = Date.now()
      const signature = createMqttDeviceSignature(deviceId, employeeId, timestamp)

      const isValid = verifyMqttDeviceSignature(deviceId, employeeId, timestamp, signature)
      expect(isValid).toBe(true)
    })

    it('Chống Replay Attack: Chối bỏ các request có timestamp lệch quá 5 phút', () => {
      const deviceId = 'DEV-001'
      const employeeId = 'NV-100'
      const oldTimestamp = Date.now() - 6 * 60 * 1000 // Cũ hơn 6 phút
      const signature = createMqttDeviceSignature(deviceId, employeeId, oldTimestamp)

      const isValid = verifyMqttDeviceSignature(deviceId, employeeId, oldTimestamp, signature)
      expect(isValid).toBe(false)
    })
  })

  describe('6. common/logger.ts (Logger)', () => {
    it('Logger khởi tạo đúng level và hỗ trợ child context', () => {
      const customLogger = new Logger('TestModule', 'info')
      expect(customLogger.getLevel()).toBe('info')

      const child = customLogger.child('SubModule')
      expect(child.getLevel()).toBe('info')

      customLogger.setLevel('warn')
      expect(customLogger.getLevel()).toBe('warn')
    })
  })

  describe('7. Tự động sinh mật khẩu & gửi email tài khoản nhân viên mới', () => {
    it('generateRandomPassword sinh mật khẩu ngẫu nhiên đúng 8 ký tự với chữ hoa, chữ thường và số', () => {
      const pwd = generateRandomPassword(8)
      expect(pwd.length).toBe(8)
      // Chứa ít nhất một chữ hoa
      expect(/[A-Z]/.test(pwd)).toBe(true)
      // Chứa ít nhất một chữ thường
      expect(/[a-z]/.test(pwd)).toBe(true)
      // Chứa ít nhất một chữ số
      expect(/[0-9]/.test(pwd)).toBe(true)
    })

    it('sendAccountCredentialsEmail xử lý an toàn ở chế độ mô phỏng khi chưa có SMTP hoặc bật cờ simulate', async () => {
      const res = await sendAccountCredentialsEmail({
        to: 'nhanvien.moi@example.com',
        fullName: 'Trần Văn Mới',
        employeeCode: 'NV-999',
        rawPassword: 'Abc12345',
        simulate: true,
      })

      expect(res.success).toBe(true)
      expect(res.simulated).toBe(true)
    })
  })
})
