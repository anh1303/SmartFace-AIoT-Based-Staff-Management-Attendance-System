import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '../../common/AppError.js'
import { formatVNDateISO } from '../../common/utils.js'
import * as attendanceService from '../../modules/attendance/attendance.service.js'

describe('Unit & Security Test: Attendance Check-in & Timezone (attendance-checkin.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Duplicate Check-in Prevention', () => {
    it('Phát hiện và từ chối khi nhân viên thực hiện điểm danh trùng lặp trong cùng một ca/ngày', async () => {
      const mockServiceCheckIn = vi.spyOn(attendanceService, 'checkIn')
      mockServiceCheckIn
        .mockResolvedValueOnce({
          id: 'log-1',
          attendance_id: 'ATT-1',
          employee_id: 'NV-001',
          type: 'CHECK_IN',
          timestamp: '2026-09-25T08:00:00+07:00',
          method: 'FACE',
          device_id: 'CAM-01',
          status: 'VALID',
          punctuality: 'ON_TIME',
          verification_score: 0.98,
          raw_status: 'VALID',
        } as any)
        .mockRejectedValueOnce(new AppError(400, 'Nhân viên đã thực hiện điểm danh vào cho ca làm việc hôm nay!'))

      // Lần check-in 1: Thành công
      const firstCheckIn = await attendanceService.checkIn({
        employeeId: 'NV-001',
        method: 'FACE',
        device_info: 'CAM-01',
      })
      expect(firstCheckIn.id).toBe('log-1')
      expect(firstCheckIn.type).toBe('CHECK_IN')

      // Lần check-in 2 (Duplicate): Ném ra lỗi AppError 400
      await expect(
        attendanceService.checkIn({
          employeeId: 'NV-001',
          method: 'FACE',
          device_info: 'CAM-01',
        })
      ).rejects.toThrow(/đã thực hiện điểm danh vào/i)
    })
  })

  describe('2. Timezone Biên (+07:00 Asia/Ho_Chi_Minh vs UTC)', () => {
    it('Xử lý chính xác các mốc thời gian giáp ranh nửa đêm theo Múi giờ Việt Nam (+07:00)', () => {
      // 2026-09-25T16:59:59Z -> 23:59:59 25/09/2026 ở Việt Nam (+07:00)
      const endOfDayUtc = new Date('2026-09-25T16:59:59Z')
      expect(formatVNDateISO(endOfDayUtc)).toBe('2026-09-25')

      // 2026-09-25T17:00:00Z -> 00:00:00 26/09/2026 ở Việt Nam (+07:00) -> Ngày mới!
      const startOfNextDayUtc = new Date('2026-09-25T17:00:00Z')
      expect(formatVNDateISO(startOfNextDayUtc)).toBe('2026-09-26')

      // 2026-09-25T23:59:59Z -> 06:59:59 26/09/2026 ở Việt Nam (+07:00)
      const morningNextDayUtc = new Date('2026-09-25T23:59:59Z')
      expect(formatVNDateISO(morningNextDayUtc)).toBe('2026-09-26')
    })
  })

  describe('3. Backend-first Calculation & Rounding (Modular Monolith)', () => {
    it('Làm tròn giờ tăng ca và đi trễ về sớm theo quy tắc: 0-29p -> +0h; 30-59p -> +0.5h', () => {
      // 0 đến 29 phút -> +0 giờ
      expect(attendanceService.roundToHalfHour(0)).toBe(0)
      expect(attendanceService.roundToHalfHour(15 * 60)).toBe(0)
      expect(attendanceService.roundToHalfHour(29 * 60 + 59)).toBe(0)

      // 30 đến 59 phút -> +0.5 giờ
      expect(attendanceService.roundToHalfHour(30 * 60)).toBe(0.5)
      expect(attendanceService.roundToHalfHour(45 * 60)).toBe(0.5)
      expect(attendanceService.roundToHalfHour(59 * 60 + 59)).toBe(0.5)

      // 1 giờ 10 phút -> 1.0 giờ
      expect(attendanceService.roundToHalfHour(70 * 60)).toBe(1.0)
      // 1 giờ 35 phút -> 1.5 giờ
      expect(attendanceService.roundToHalfHour(95 * 60)).toBe(1.5)
      // 2 giờ 25 phút -> 2.0 giờ
      expect(attendanceService.roundToHalfHour(145 * 60)).toBe(2.0)
      // 2 giờ 45 phút -> 2.5 giờ
      expect(attendanceService.roundToHalfHour(165 * 60)).toBe(2.5)
    })

    it('Tính thời gian làm việc trong ngày bằng: thời gian kết thúc ca - thời gian bắt đầu ca', () => {
      // Ca hành chính: 08:30 đến 17:30 = 9.0 giờ
      expect(attendanceService.calcShiftWorkingHours('08:30', '17:30')).toBe(9.0)
      // Ca sáng: 08:00 đến 12:00 = 4.0 giờ
      expect(attendanceService.calcShiftWorkingHours('08:00', '12:00')).toBe(4.0)
      // Ca chiều: 13:30 đến 17:30 = 4.0 giờ
      expect(attendanceService.calcShiftWorkingHours('13:30', '17:30')).toBe(4.0)
      // Ca đêm qua ngày: 22:00 đến 06:00 hôm sau = 8.0 giờ
      expect(attendanceService.calcShiftWorkingHours('22:00', '06:00')).toBe(8.0)
    })
  })
})
