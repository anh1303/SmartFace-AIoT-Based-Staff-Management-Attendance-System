import { configureAttendancePayroll } from '../../modules/attendance/attendance.payroll-port.js'
import * as payrollIntegration from '../../modules/payroll/public.js'
configureAttendancePayroll(payrollIntegration)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extractTimeString,
  roundToHalfHour,
  parseTimeToSecondsInVN,
  aggregateDailyAttendance,
} from '../../modules/attendance/attendance.service.js'
import { ATTENDANCE_POLICY_VERSION } from '../../modules/attendance/attendance.policy.js'
import * as attendanceService from '../../modules/attendance/public.js'
import * as payrollService from '../../modules/payroll/payroll.service.js'
import { prisma } from '../../config/database.js'

// Keep these unit fixtures completely disconnected from the configured database.
vi.mock('../../config/database.js', () => ({ prisma: {
  $transaction: vi.fn(), $executeRaw: vi.fn(async () => 1),
  employee: { findMany: vi.fn() }, employee_shifts: { findMany: vi.fn() }, attendance_logs: { findMany: vi.fn() },
  work_shifts: { findFirst: vi.fn() }, daily_attendance_summary: { findMany: vi.fn(), upsert: vi.fn() },
  attendance_locks: { findMany: vi.fn() }, payrollRecord: { findMany: vi.fn() },
  attendanceAdjustment: { findMany: vi.fn(async () => []) },
  bonusPenalty: { findFirst: vi.fn(async () => null) },
  auditLog: { findMany: vi.fn(), createMany: vi.fn(async () => ({ count: 0 })) },
} }))

describe('Unit Test: Attendance Aggregation & Flow to Payroll (attendance-aggregation.test.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback(prisma)
    })
    vi.spyOn(prisma.attendance_locks, 'findMany').mockResolvedValue([])
    vi.spyOn(prisma.payrollRecord, 'findMany').mockResolvedValue([])
    vi.spyOn(prisma, '$executeRaw').mockResolvedValue(1 as any)
  })

  describe('1. Helper Functions: Tính toán giờ làm, trễ/sớm và tăng ca', () => {
    it('roundToHalfHour: Làm tròn theo quy tắc 0-29 phút quy về +0h, 30-59 phút quy về +0.5h', () => {
      expect(roundToHalfHour(0)).toBe(0)
      expect(roundToHalfHour(60)).toBe(0) // 1 phút -> 0h
      expect(roundToHalfHour(800)).toBe(0) // < 15 phút -> 0h
      expect(roundToHalfHour(900)).toBe(0) // 15 phút (0-29p) -> 0h
      expect(roundToHalfHour(1740)).toBe(0) // 29 phút (0-29p) -> 0h
      expect(roundToHalfHour(1800)).toBe(0.5) // 30 phút (30-59p) -> 0.5h
      expect(roundToHalfHour(2700)).toBe(0.5) // 45 phút (30-59p) -> 0.5h
      expect(roundToHalfHour(3540)).toBe(0.5) // 59 phút (30-59p) -> 0.5h
      expect(roundToHalfHour(3600)).toBe(1.0) // 60 phút (1h 0p) -> 1.0h
      expect(roundToHalfHour(4200)).toBe(1.0) // 70 phút (1h 10p, 0-29p) -> 1.0h
      expect(roundToHalfHour(5400)).toBe(1.5) // 90 phút (1h 30p, 30-59p) -> 1.5h
      expect(roundToHalfHour(7140)).toBe(1.5) // 119 phút (1h 59p, 30-59p) -> 1.5h
    })

    it('extractTimeString: Trích xuất chuỗi HH:mm từ Date, string ISO hoặc fallback', () => {
      expect(extractTimeString(new Date('1970-01-01T08:00:00.000Z'))).toBe('08:00')
      expect(extractTimeString(new Date('1970-01-01T13:30:00.000Z'))).toBe('13:30')
      expect(extractTimeString('08:30:00')).toBe('08:30')
      expect(extractTimeString('17:00')).toBe('17:00')
      expect(extractTimeString(null, '08:00')).toBe('08:00')
    })

    it('parseTimeToSecondsInVN: Chuyển đổi chính xác sang số giây trong ngày theo múi giờ Việt Nam', () => {
      // 08:00:00 sáng VN (+07:00) = 8 * 3600 = 28800 giây
      const d = new Date('2026-09-25T08:00:00+07:00')
      expect(parseTimeToSecondsInVN(d)).toBe(28800)

      // 18:30:00 chiều VN = 18 * 3600 + 30 * 60 = 66600 giây
      const d2 = new Date('2026-09-25T18:30:00+07:00')
      expect(parseTimeToSecondsInVN(d2)).toBe(66600)
    })
  })

  describe('2. aggregateDailyAttendance: Tự động gom nhóm và tổng hợp từ logs sang daily_attendance_summary', () => {
    it('includes employees with shifts when running without an employee filter', async () => {
      vi.spyOn(prisma.employee, 'findMany').mockResolvedValue([])
      await aggregateDailyAttendance(9, 2026)
      const where = vi.mocked(prisma.employee.findMany).mock.calls[0][0]?.where
      expect(JSON.stringify(where)).toContain('employee_shifts')
    })
    it('Tổng hợp thành công một ngày làm việc chuẩn (Đúng giờ, không trễ, không OT)', async () => {
      const mockEmp = { id: '00000000-0000-0000-0000-000000000001', employee_code: 'NV-001', full_name: 'Nguyễn Văn A' }
      const mockShift = {
        id: BigInt(1),
        employee_id: mockEmp.id,
        shift_id: 1,
        work_date: new Date('2026-09-15T00:00:00.000Z'),
        start_time: new Date('1970-01-01T08:00:00.000Z'),
        end_time: new Date('1970-01-01T18:00:00.000Z'),
        work_shifts: { id: 1, shift_name: 'Full time', start_time: new Date('1970-01-01T08:00:00.000Z'), end_time: new Date('1970-01-01T18:00:00.000Z') },
      }
      const mockLogs = [
        {
          id: BigInt(1),
          employee_id: mockEmp.id,
          event_time: new Date('2026-09-15T08:00:00+07:00'),
          type: 'CHECK_IN',
          status: 'VALID',
        },
        {
          id: BigInt(2),
          employee_id: mockEmp.id,
          event_time: new Date('2026-09-15T18:00:00+07:00'),
          type: 'CHECK_OUT',
          status: 'VALID',
        },
      ]

      vi.spyOn(prisma.employee, 'findMany').mockResolvedValue([mockEmp] as any)
      vi.spyOn(prisma.employee_shifts, 'findMany').mockResolvedValue([mockShift] as any)
      vi.spyOn(prisma.attendance_logs, 'findMany').mockResolvedValue(mockLogs as any)
      vi.spyOn(prisma.work_shifts, 'findFirst').mockResolvedValue({ id: 1, shift_name: 'Full time' } as any)
      vi.spyOn(prisma.daily_attendance_summary, 'findMany').mockResolvedValue([])
      vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([])

      const upsertSpy = vi.spyOn(prisma.daily_attendance_summary, 'upsert').mockResolvedValue({} as any)

      const result = await aggregateDailyAttendance(9, 2026, 'NV-001')

      expect(result.month).toBe(9)
      expect(result.year).toBe(2026)
      expect(result.totalSummaries).toBe(1)
      expect(result.details).toHaveLength(1)
      expect(result.details[0].status).toBe('PRESENT')
      expect(result.details[0].total_working_hours).toBe(10) // 08:00 -> 18:00 = 10h
      expect(result.details[0].late_early).toBe(0)
      expect(result.details[0].overtime).toBe(0)

      expect(upsertSpy).toHaveBeenCalledTimes(1)
      const upsertArgs = upsertSpy.mock.calls[0][0]
      expect(upsertArgs.create.attendance_status).toBe('PRESENT')
      expect(upsertArgs.create.total_working_hours).toBe(10)
    })

    it('Xử lý chính xác nhân viên đi trễ quá 15 phút và có tăng ca (OT)', async () => {
      const mockEmp = { id: '00000000-0000-0000-0000-000000000005', employee_code: 'NV-005', full_name: 'Nguyễn Hải Nam' }
      const mockShift = {
        id: BigInt(5),
        employee_id: mockEmp.id,
        shift_id: 1,
        work_date: new Date('2026-09-19T00:00:00.000Z'),
        start_time: new Date('1970-01-01T08:00:00.000Z'),
        end_time: new Date('1970-01-01T18:00:00.000Z'),
        work_shifts: { id: 1, shift_name: 'Full time', start_time: new Date('1970-01-01T08:00:00.000Z'), end_time: new Date('1970-01-01T18:00:00.000Z') },
      }
      // Vào ca 08:35 (trễ 35p -> làm tròn 0.5h), Hết ca 18:40 (vượt ca 40p -> làm tròn 0.5h OT)
      const mockLogs = [
        {
          id: BigInt(10),
          employee_id: mockEmp.id,
          event_time: new Date('2026-09-19T08:35:00+07:00'),
          type: 'CHECK_IN',
          status: 'VALID',
        },
        {
          id: BigInt(11),
          employee_id: mockEmp.id,
          event_time: new Date('2026-09-19T18:40:00+07:00'),
          type: 'CHECK_OUT',
          status: 'VALID',
        },
      ]

      vi.spyOn(prisma.employee, 'findMany').mockResolvedValue([mockEmp] as any)
      vi.spyOn(prisma.employee_shifts, 'findMany').mockResolvedValue([mockShift] as any)
      vi.spyOn(prisma.attendance_logs, 'findMany').mockResolvedValue(mockLogs as any)
      vi.spyOn(prisma.work_shifts, 'findFirst').mockResolvedValue({ id: 1, shift_name: 'Full time' } as any)
      vi.spyOn(prisma.daily_attendance_summary, 'findMany').mockResolvedValue([])
      vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([])
      vi.spyOn(prisma.daily_attendance_summary, 'upsert').mockResolvedValue({} as any)

      const result = await aggregateDailyAttendance(9, 2026, 'NV-005')

      expect(result.totalSummaries).toBe(1)
      expect(result.details[0].status).toBe('LATE')
      expect(result.details[0].late_early).toBe(0.5) // 35 phút làm tròn thành 0.5 giờ
      expect(result.details[0].overtime).toBe(0) // Proposed OT is unpaid until approved.
      expect(result.details[0].overtime_candidate_hours).toBe(0.5)
    })

    it('Ghi nhận ABSENT khi có lịch phân ca nhưng không có quẹt thẻ nào', async () => {
      const mockEmp = { id: '00000000-0000-0000-0000-000000000003', employee_code: 'NV-003', full_name: 'Nguyễn Minh Anh' }
      const mockShift = {
        id: BigInt(3),
        employee_id: mockEmp.id,
        shift_id: 1,
        work_date: new Date('2026-09-20T00:00:00.000Z'),
        start_time: new Date('1970-01-01T08:00:00.000Z'),
        end_time: new Date('1970-01-01T18:00:00.000Z'),
        work_shifts: { id: 1, shift_name: 'Full time' },
      }

      vi.spyOn(prisma.employee, 'findMany').mockResolvedValue([mockEmp] as any)
      vi.spyOn(prisma.employee_shifts, 'findMany').mockResolvedValue([mockShift] as any)
      vi.spyOn(prisma.attendance_logs, 'findMany').mockResolvedValue([]) // Không có log
      vi.spyOn(prisma.work_shifts, 'findFirst').mockResolvedValue({ id: 1, shift_name: 'Full time' } as any)
      vi.spyOn(prisma.daily_attendance_summary, 'findMany').mockResolvedValue([])
      vi.spyOn(prisma.auditLog, 'findMany').mockResolvedValue([])
      vi.spyOn(prisma.daily_attendance_summary, 'upsert').mockResolvedValue({} as any)

      const result = await aggregateDailyAttendance(9, 2026, 'NV-003')

      expect(result.totalSummaries).toBe(1)
      expect(result.details[0].status).toBe('ABSENT')
      expect(result.details[0].total_working_hours).toBe(0)
    })
  })

  describe('3. Tích hợp thông suốt: generate payroll tự động kích hoạt aggregateDailyAttendance', () => {
    it('Khi gọi tính lương (generate), hệ thống tự động tổng hợp attendance_logs trước', async () => {
      const mockAggregate = vi.spyOn(attendanceService, 'aggregateDailyAttendance')
      mockAggregate.mockResolvedValue({
        month: 9,
        year: 2026,
        totalSummaries: 5,
        details: [],
      })

      const mockEmployee = {
        id: '00000000-0000-0000-0000-000000000001',
        employee_code: 'NV-001',
        full_name: 'Nguyễn Văn A',
        hourly_rate: 100000,
        department: { name: 'Quản lý' },
      }

      const mockSummaries = [
        {
          id: BigInt(1),
          employee_id: mockEmployee.id,
          work_date: new Date('2026-09-01T00:00:00.000Z'),
          total_working_hours: 10,
          overtime: 1,
          late_early: 0,
          policy_version: ATTENDANCE_POLICY_VERSION,
        },
      ]

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          $executeRaw: vi.fn(async () => 1),
          attendanceAdjustment: { findMany: vi.fn(async () => []) },
          auditLog: { create: vi.fn(async () => ({})) },
          employee: {
            findMany: vi.fn().mockResolvedValue([mockEmployee]),
          },
          payrollRecord: {
            findMany: vi.fn().mockResolvedValue([]),
            findUnique: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue({
              id: BigInt(1),
              employeeId: mockEmployee.id,
              payroll_period: '2026-09',
              net_salary: 2600000,
              employee: mockEmployee,
            }),
          },
          daily_attendance_summary: {
            findMany: vi.fn().mockResolvedValue(mockSummaries),
          },
        })
      })

      vi.spyOn(payrollService, 'getBonusPenalty').mockResolvedValue({
        overtime_rate: 100000,
        late_early_penalty: 50000,
      } as any)

      await payrollService.generate('2026-09', undefined, 'admin-1', { id: 'admin-1', role: 'ADMIN' })

      // Kiểm tra aggregateDailyAttendance được gọi tự động với đúng tháng 9 và năm 2026
      expect(mockAggregate).toHaveBeenCalledWith(9, 2026, undefined, undefined, {})
    })
  })
})
