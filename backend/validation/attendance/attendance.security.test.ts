import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { adjustmentFingerprint } from '../../src/modules/attendance/attendance.adjustments.js'
import { prisma } from '../../src/config/database.js'

const state = vi.hoisted(() => ({
  record: null as any,
  summaries: [] as any[],
  adjustments: [] as any[],
  shifts: [] as any[],
  employee: null as any,
  allEmployees: [] as any[],
  attendanceLogs: [] as any[],
  auditLogs: [] as any[],
}))

vi.mock('../../src/modules/attendance/index.js', () => ({
  aggregateDailyAttendance: vi.fn(async () => ({ details: [] })),
  getAttendanceSummariesByEmployeesAndDateRange: vi.fn(),
}))

vi.mock('../../src/config/database.js', () => {
  const db: any = {
    $executeRaw: vi.fn(async () => 1),
    $queryRaw: vi.fn(async () => [{
      emp_id: state.employee?.id || '11111111-1111-4111-8111-111111111111',
      employee_code: state.employee?.employee_code || 'NV-001',
      full_name: state.employee?.full_name || 'Nguyễn Văn A',
      avatar_url: null,
      embedding_type: 'arcface',
      similarity: 0.95,
    }]),
    employee: {
      update: vi.fn(async ({ data }: any) => { Object.assign(state.employee, data); return state.employee }),
      findMany: vi.fn(async (args?: any) => {
        let list = state.allEmployees
        if (args?.where?.departmentId !== undefined) {
          list = list.filter((e: any) => e.departmentId === args.where.departmentId)
        }
        if (args?.where?.AND) {
          const ands = Array.isArray(args.where.AND) ? args.where.AND : [args.where.AND]
          for (const cond of ands) {
            if (cond.id?.in) {
              list = list.filter((e: any) => cond.id.in.includes(e.id))
            } else if (typeof cond.id === 'string') {
              list = list.filter((e: any) => e.id === cond.id)
            }
            if (typeof cond.employee_code === 'string') {
              list = list.filter((e: any) => e.employee_code === cond.employee_code)
            }
            if (cond.OR) {
              const ids = cond.OR.map((o: any) => o.id || o.employee_code).filter(Boolean)
              if (ids.length) list = list.filter((e: any) => ids.includes(e.id) || ids.includes(e.employee_code))
            }
          }
        }
        return list
      }),
      findFirst: vi.fn(async (args?: any) => {
        if (args?.where?.user_id) {
          return state.allEmployees.find((e: any) => e.user_id === args.where.user_id) || null
        }
        let list = state.allEmployees
        if (args?.where?.AND) {
          const ands = Array.isArray(args.where.AND) ? args.where.AND : [args.where.AND]
          for (const cond of ands) {
            if (cond.id?.in) {
              list = list.filter((e: any) => cond.id.in.includes(e.id))
            } else if (typeof cond.id === 'string') {
              list = list.filter((e: any) => e.id === cond.id)
            }
            if (typeof cond.employee_code === 'string') {
              list = list.filter((e: any) => e.employee_code === cond.employee_code)
            }
            if (cond.OR) {
              const ids = cond.OR.map((o: any) => o.id || o.employee_code).filter(Boolean)
              if (ids.length) list = list.filter((e: any) => ids.includes(e.id) || ids.includes(e.employee_code))
            }
          }
          return list[0] || null
        }
        if (args?.where?.id) {
          return state.allEmployees.find((e: any) => e.id === args.where.id) || null
        }
        if (args?.where?.employee_code) {
          return state.allEmployees.find((e: any) => e.employee_code === args.where.employee_code) || null
        }
        if (args?.where?.OR) {
          const ids = args.where.OR.map((o: any) => o.id || o.employee_code).filter(Boolean)
          return state.allEmployees.find((e: any) => ids.includes(e.id) || ids.includes(e.employee_code)) || null
        }
        return state.employee
      }),
    },
    bonusPenalty: {
      findFirst: vi.fn(async () => ({
        id: 1,
        overtime_rate: 100000,
        late_early_penalty: 50000,
        absence_penalty_rate: 0.25,
        overtime_rate_kind: 'FIXED_PER_HOUR',
        late_early_penalty_kind: 'FIXED_PER_HOUR',
      })),
    },
    daily_attendance_summary: {
      findMany: vi.fn(async (args?: any) => {
        let rows = state.summaries
        if (args?.where?.work_date?.lt) {
          const lt = new Date(args.where.work_date.lt)
          rows = rows.filter((s: any) => new Date(s.work_date) < lt)
        }
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          rows = rows.filter((s: any) => new Date(s.work_date) >= gte)
        }
        return rows
      }),
      count: vi.fn(async () => 0),
      upsert: vi.fn(async ({ create, update, where }: any) => {
        const existing = state.summaries.find(
          (s: any) => s.employee_id === where?.employee_id_work_date?.employee_id &&
                      +new Date(s.work_date) === +new Date(where?.employee_id_work_date?.work_date)
        )
        if (existing) {
          Object.assign(existing, update)
          return existing
        } else {
          const newSummary = { id: BigInt(state.summaries.length + 1), ...create }
          state.summaries.push(newSummary)
          return newSummary
        }
      }),
      deleteMany: vi.fn(async (args?: any) => {
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          const initialLen = state.summaries.length
          state.summaries = state.summaries.filter((s: any) => new Date(s.work_date) < gte)
          return { count: initialLen - state.summaries.length }
        }
        return { count: 0 }
      }),
    },
    attendanceAdjustment: {
      findMany: vi.fn(async (args?: any) => {
        let rows = state.adjustments || []
        if (args?.where?.work_date?.lt) {
          const lt = new Date(args.where.work_date.lt)
          rows = rows.filter((a: any) => new Date(a.work_date) < lt)
        }
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          rows = rows.filter((a: any) => new Date(a.work_date) >= gte)
        }
        return rows
      }),
      count: vi.fn(async (args?: any) => {
        let rows = state.adjustments || []
        if (args?.where?.status) {
          rows = rows.filter((a: any) => a.status === args.where.status)
        }
        if (args?.where?.work_date?.lt) {
          const lt = new Date(args.where.work_date.lt)
          rows = rows.filter((a: any) => new Date(a.work_date) < lt)
        }
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          rows = rows.filter((a: any) => new Date(a.work_date) >= gte)
        }
        return rows.length
      }),
      deleteMany: vi.fn(async (args?: any) => {
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          const initialLen = (state.adjustments || []).length
          state.adjustments = (state.adjustments || []).filter((a: any) => new Date(a.work_date) < gte)
          return { count: initialLen - state.adjustments.length }
        }
        return { count: 0 }
      }),
    },
    attendance_locks: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        state.auditLogs.push(data)
        return data
      }),
    },
    attendance_logs: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async (args?: any) => state.attendanceLogs.filter(log => !args?.where?.OR || (
        (!args.where.status || log.status === args.where.status) && (
          log.work_date && new Date(log.work_date) >= new Date(args.where.OR[0].work_date.gte)
          || (args.where.OR[1].work_date === undefined || log.work_date == null) && new Date(log.event_time) >= new Date(args.where.OR[1].event_time.gte)
        )
      ))),
      create: vi.fn(async ({ data }: any) => {
        const log = { id: BigInt(state.attendanceLogs.length + 1), ...data }
        state.attendanceLogs.push(log)
        return log
      }),
    },
    employee_shifts: {
      findMany: vi.fn(async (args?: any) => {
        let rows = state.shifts || []
        if (args?.where?.work_date?.lt) {
          const lt = new Date(args.where.work_date.lt)
          rows = rows.filter((s: any) => new Date(s.work_date) < lt)
        }
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          rows = rows.filter((s: any) => new Date(s.work_date) >= gte)
        }
        return rows
      }),
      deleteMany: vi.fn(async (args?: any) => {
        if (args?.where?.work_date?.gte) {
          const gte = new Date(args.where.work_date.gte)
          const initialLen = (state.shifts || []).length
          state.shifts = (state.shifts || []).filter((s: any) => new Date(s.work_date) < gte)
          return { count: initialLen - state.shifts.length }
        }
        return { count: 0 }
      }),
    },
    payrollRecord: {
      count: vi.fn(async () => state.record?.status === 'PAID' ? 1 : 0),
      findUnique: vi.fn(async () => state.record ? { ...state.record, employee: state.employee } : null),
      findUniqueOrThrow: vi.fn(async () => ({ ...state.record, employee: state.employee })),
      findFirst: vi.fn(async (args?: any) => {
        if (!state.record) return null
        if (args?.where?.status?.in && !args.where.status.in.includes(state.record.status)) {
          return null
        }
        if (args?.where?.employeeId && state.record.employeeId !== args.where.employeeId) {
          return null
        }
        if (args?.where?.payroll_period && state.record.payroll_period !== args.where.payroll_period) {
          return null
        }
        return { ...state.record, employee: state.employee }
      }),
      findMany: vi.fn(async () => state.record ? [{ ...state.record, employee: state.employee }] : []),
      upsert: vi.fn(async ({ update }: any) => {
        state.record = { ...state.record, ...update, employee: state.employee }
        return state.record
      }),
      update: vi.fn(async ({ data }: any) => {
        state.record = { ...state.record, ...data, employee: state.employee }
        return state.record
      }),
      updateMany: vi.fn(async ({ data, where }: any) => {
        if (data?.status && state.record && (!where?.id?.in || where.id.in.includes(state.record.id))) state.record.status = data.status
        return { count: 1 }
      }),
    },
  }
  db.$transaction = async (work: any) => work(db)
  return { prisma: db }
})

import { checkIn, checkOut, devSimulateFaceScan, handleThingsBoardWebhook } from '../../src/modules/attendance/attendance.service.js'
import { checkInSchema } from '../../src/modules/attendance/attendance.dto.js'
import { generate, finalizePeriod, finalizeEarlySettlement, previewEarlySettlement, unlockPeriod } from '../../src/modules/payroll/payroll.service.js'

const admin = { id: 'admin-user-01', role: 'ADMIN' }
const manager = { id: '33333333-0000-0000-0000-000000000001', role: 'MANAGER' }

describe('Attendance Security & Period Finalization Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T10:00:00+07:00'))

    state.attendanceLogs = []
    state.auditLogs = []
    state.adjustments = []
    state.shifts = []

    const empA = {
      id: '11111111-1111-4111-8111-111111111111',
      employee_code: 'NV-001',
      full_name: 'Nguyễn Văn A',
      hourly_rate: 100000,
      status: 'ACTIVE',
      departmentId: 1,
      user_id: 'employee-user-01',
      department: { name: 'IT' },
      position: { name: 'Developer', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    }

    const staffIT = {
      id: '22222222-2222-4222-8222-222222222222',
      employee_code: 'EMP_STAFF_IT',
      full_name: 'Nhân viên IT',
      hourly_rate: 100000,
      status: 'ACTIVE',
      departmentId: 1,
      user_id: 'user-staff-it',
      department: { name: 'IT' },
      position: { name: 'Developer', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    }

    const mgrIT = {
      id: '33333333-3333-4333-8333-333333333333',
      employee_code: 'EMP_MGR_IT',
      full_name: 'Manager IT',
      hourly_rate: 200000,
      status: 'ACTIVE',
      departmentId: 1,
      user_id: '33333333-0000-0000-0000-000000000001',
      department: { name: 'IT' },
      position: { name: 'Trưởng phòng IT', level: 'MANAGER' },
      users: { roles: { role_name: 'MANAGER' } },
    }

    const mgrHR = {
      id: '44444444-4444-4444-8444-444444444444',
      employee_code: 'EMP_MGR_HR',
      full_name: 'Manager HR',
      hourly_rate: 200000,
      status: 'ACTIVE',
      departmentId: 2,
      user_id: '44444444-0000-0000-0000-000000000002',
      department: { name: 'HR' },
      position: { name: 'Trưởng phòng HR', level: 'MANAGER' },
      users: { roles: { role_name: 'MANAGER' } },
    }

    const staffHR = {
      id: '55555555-5555-4555-8555-555555555555',
      employee_code: 'EMP_STAFF_HR',
      full_name: 'Staff HR',
      hourly_rate: 90000,
      status: 'ACTIVE',
      departmentId: 2,
      user_id: '55555555-0000-0000-0000-000000000003',
      department: { name: 'HR' },
      position: { name: 'Nhân viên HR', level: 'EMPLOYEE' },
      users: { roles: { role_name: 'EMPLOYEE' } },
    }

    state.allEmployees = [empA, staffIT, mgrIT, mgrHR, staffHR]
    state.employee = empA

    state.summaries = [
      {
        id: BigInt(1),
        employee_id: state.employee.id,
        work_date: new Date('2026-10-14T00:00:00Z'),
        total_working_hours: 8,
        overtime: 0,
        late_early: 0,
        overtime_status: 'NONE',
        policy_version: '2026-10-26-v5',
        requires_review: false,
        calculation_details: {
          fingerprint: 'fp-summary-01',
          policy: '2026-10-26-v5',
          scheduledEnd: '2026-10-14T17:00:00+07:00',
        },
      },
    ]

    state.record = {
      id: BigInt(1),
      employeeId: state.employee.id,
      employee: state.employee,
      payroll_period: '2026-10',
      hourly_rate: 100000,
      total_working_hours: 8,
      total_overtime: 0,
      total_late_early: 0,
      total_absence_penalty: 0,
      allowance: 1500000,
      net_salary: 2300000,
      overtime_rate: 100000,
      late_penalty_rate: 50000,
      overtime_rate_kind: 'FIXED_PER_HOUR',
      late_penalty_rate_kind: 'FIXED_PER_HOUR',
      status: 'PENDING',
      updated_at: new Date('2026-10-15T09:00:00Z'),
      calculation_details: {
        policy: '2026-10-26-v5',
        adjustment_fingerprint: adjustmentFingerprint([]),
      },
    }
  })

  const initialEnv = process.env.NODE_ENV

  afterEach(() => {
    vi.useRealTimers()
    process.env.NODE_ENV = initialEnv
  })

  describe('1. Early Settlement Recalculation (Scenario 1)', () => {
    it('recalculates a stale draft after removing unworked future summaries and pending proposals', async () => {
      // Setup: Clock = 2026-10-20
      vi.setSystemTime(new Date('2026-10-20T10:00:00+07:00'))

      // Employee A (hourly_rate = 100,000, allowance = 1,500,000)
      // Day 05/10: 9h (900,000đ)
      // Day 18/10: unworked summary, 0h
      state.summaries = [
        {
          id: BigInt(1),
          employee_id: state.employee.id,
          work_date: new Date('2026-10-05T00:00:00Z'),
          total_working_hours: 9,
          overtime: 0,
          late_early: 0,
          overtime_status: 'NONE',
          policy_version: '2026-10-26-v5',
          requires_review: false,
          calculation_details: {
            fingerprint: 'fp-summary-05',
            policy: '2026-10-26-v5',
            scheduledEnd: '2026-10-05T17:00:00+07:00',
          },
        },
        {
          id: BigInt(2),
          employee_id: state.employee.id,
          work_date: new Date('2026-10-18T00:00:00Z'),
          total_working_hours: 0,
          overtime: 0,
          late_early: 0,
          overtime_status: 'NONE',
          policy_version: '2026-10-26-v5',
          requires_review: false,
          calculation_details: {
            fingerprint: 'fp-summary-18',
            policy: '2026-10-26-v5',
            scheduledEnd: '2026-10-18T17:00:00+07:00',
          },
        },
      ]

      // Pending absence proposal after cutoff; it has not been approved.
      state.adjustments = [
        {
          id: BigInt(101),
          employee_id: state.employee.id,
          work_date: new Date('2026-10-16T00:00:00Z'),
          kind: 'ABSENCE',
          amount: 250000,
          hours: 0,
          status: 'PENDING',
        },
      ]

      // Initial pending payroll: total_working_hours = 18h, total_absence_penalty = 250,000đ,
      // net_salary = 18 * 100,000 + 1,500,000 allowance - 250,000 absence penalty = 3,050,000đ
      state.record = {
        id: BigInt(1),
        employeeId: state.employee.id,
        employee: state.employee,
        payroll_period: '2026-10',
        hourly_rate: 100000,
        total_working_hours: 18,
        total_overtime: 0,
        total_late_early: 0,
        total_absence_penalty: 250000,
        allowance: 1500000,
        net_salary: 3050000,
        status: 'PENDING',
        calculation_details: {
          policy: '2026-10-26-v5',
        },
      }

      // Action: Call finalizeEarlySettlement with cutoffDate = '2026-10-10' (Oct 16 penalty and Oct 18 shift are after cutoffDate)
      const result = await finalizeEarlySettlement(
        {
          employeeId: state.employee.id,
          period: '2026-10',
          cutoffDate: '2026-10-10',
          reason: 'Nhân viên nghỉ việc giữa tháng (10/10)',
        },
        admin.id,
        admin.role
      )

      // Assertion:
      // 1. Status must be FINALIZED
      expect(result.status).toBe('FINALIZED')
      // 2. Future adjustments (Oct 16) must be deleted from attendance_adjustments
      expect(state.adjustments.find((a) => a.id === BigInt(101))).toBeUndefined()
      // 3. total_working_hours must be recalculated to 9h (only Oct 05, Oct 18 excluded)
      expect(result.total_working_hours).toBe(9)
      // 4. total_absence_penalty must be recalculated to 0 (Oct 16 penalty removed)
      expect(result.total_absence_penalty).toBe(0)
      // 5. net_salary must be recalculated to 2,400,000đ (9h * 100,000 + 1,500,000 allowance - 0 penalty)
      expect(result.net_salary).toBe(2400000)
      expect(state.record.status).toBe('FINALIZED')
      expect(state.record.total_working_hours).toBe(9)
      expect(state.record.total_absence_penalty).toBe(0)
      expect(state.record.net_salary).toBe(2400000)

      // 6. Audit log must also record the recalculated values
      const audit = state.auditLogs.find((a) => a.action === 'FINALIZE_EARLY_SETTLEMENT')
      expect(audit).toBeDefined()
      expect(audit?.new_values?.total_working_hours).toBe(9)
      expect(audit?.new_values?.net_salary).toBe(2400000)
      expect(audit?.new_values?.cutoffDate).toBe('2026-10-10')
    })

    it('rejects early settlement if cutoff date is in the future', async () => {
      // Today is 2026-10-15, trying to settle for 2026-10-20
      await expect(
        finalizeEarlySettlement(
          {
            employeeId: state.employee.id,
            period: '2026-10',
            cutoffDate: '2026-10-20',
            reason: 'Nghỉ việc',
          },
          admin.id,
          admin.role
        )
      ).rejects.toThrow(/tương lai/)
    })
  })

  describe('2. Period Boundary Finalization Check (Scenario 2)', () => {
    it('Scenario 2: rejects finalizing on morning of last day of month (2026-10-31T08:30:00+07:00) with 409 Conflict', async () => {
      // 8:30 AM on Oct 31, 2026 (last day of October)
      vi.setSystemTime(new Date('2026-10-31T08:30:00+07:00'))

      await generate('2026-10', state.employee.id, admin.id, admin)
      await expect(finalizePeriod('2026-10', admin.id, admin.role)).rejects.toThrow(
        /Kỳ lương chưa kết thúc/
      )
    })

    it('Scenario 2 overnight shift: rejects finalizing at 2026-11-01T00:00:01+07:00 when an overnight shift on Oct 31 (22:00 to 06:00 Nov 1) is still in progress, and succeeds after 06:00', async () => {
      // 00:00:01 AM on Nov 1, 2026
      vi.setSystemTime(new Date('2026-11-01T00:00:01+07:00'))

      // Employee has an overnight shift on Oct 31: 22:00 to 06:00 (ends 2026-11-01T06:00:00+07:00)
      state.shifts = [
        {
          id: 1,
          employee_id: state.employee.id,
          work_date: new Date('2026-10-31T00:00:00Z'),
          start_time: '22:00',
          end_time: '06:00',
          shift_type: 'NORMAL',
        },
      ]

      state.summaries = [
        {
          id: BigInt(31),
          employee_id: state.employee.id,
          work_date: new Date('2026-10-31T00:00:00Z'),
          total_working_hours: 8,
          overtime: 0,
          late_early: 0,
          overtime_status: 'NONE',
          policy_version: '2026-10-29-v6',
          requires_review: false,
          calculation_details: {
            fingerprint: 'fp-summary-31',
            policy: '2026-10-29-v6',
            scheduledStart: '2026-10-31T22:00:00+07:00',
            scheduledEnd: '2026-11-01T06:00:00+07:00',
            off: false,
          },
        },
      ]

      await generate('2026-10', state.employee.id, admin.id, admin)

      // At 00:00:01 AM, overnight shift is STILL ONGOING (ends at 06:00 AM)
      await expect(finalizePeriod('2026-10', admin.id, admin.role)).rejects.toThrow(
        /Còn ca chưa kết thúc, bao gồm ca qua đêm; chưa thể chốt lương/
      )

      // Advance clock past shift end: 06:30:00 AM on Nov 1
      vi.setSystemTime(new Date('2026-11-01T06:30:00+07:00'))

      // Now finalizePeriod must succeed!
      const res = await finalizePeriod('2026-10', admin.id, admin.role)
      expect(res).toBeDefined()
      expect(state.record.status).toBe('FINALIZED')
    })

    it('Scenario 2 counter-check: allows finalizing past period once month completely ends and all shifts finished (2026-11-01T00:00:01+07:00 without active shifts)', async () => {
      // Midnight passing into Nov 1, 2026 with no active shifts running
      vi.setSystemTime(new Date('2026-11-01T00:00:01+07:00'))
      state.shifts = []
      state.summaries = [
        {
          id: BigInt(1),
          employee_id: state.employee.id,
          work_date: new Date('2026-10-14T00:00:00Z'),
          total_working_hours: 8,
          overtime: 0,
          late_early: 0,
          overtime_status: 'NONE',
          policy_version: '2026-10-26-v5',
          requires_review: false,
          calculation_details: {
            fingerprint: 'fp-summary-01',
            policy: '2026-10-26-v5',
            scheduledEnd: '2026-10-14T17:00:00+07:00',
          },
        },
      ]

      await generate('2026-10', state.employee.id, admin.id, admin)
      const res = await finalizePeriod('2026-10', admin.id, admin.role)
      expect(res).toBeDefined()
      expect(state.record.status).toBe('FINALIZED')
    })

    it('blocks a running overnight shift whose hours come from its template even without a summary for that day', async () => {
      vi.setSystemTime(new Date('2026-11-01T00:00:01+07:00'))
      state.shifts = [{ employee_id: state.employee.id, work_date: new Date('2026-10-31T00:00:00Z'), shift_type: 'NORMAL', start_time: null, end_time: null, work_shifts: { start_time: '22:00', end_time: '06:00' } }]
      await generate('2026-10', state.employee.id, admin.id, admin)
      await expect(finalizePeriod('2026-10', admin.id, admin.role)).rejects.toThrow(/ca chưa kết thúc/)
    })
  })

  describe('3. Scope & Self-Action Prevention for Manager (Scenario 3)', () => {
    it('Test 3.1: blocks Manager from self check-in via REST', async () => {
      const mgrIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_IT')!
      await expect(
        checkIn(
          {
            employeeId: mgrIT.id,
            method: 'MANUAL',
            reason: 'Quên chấm',
          },
          { id: mgrIT.user_id, role: 'MANAGER' }
        )
      ).rejects.toThrow(/Quản lý không được tự thực hiện điểm danh thủ công cho chính mình/)
    })

    it('Test 3.2: blocks Manager from peer Manager check-in via REST', async () => {
      const mgrIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_IT')!
      const mgrHR = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_HR')!
      await expect(
        checkIn(
          {
            employeeId: mgrHR.id,
            method: 'MANUAL',
            reason: 'Hỗ trợ',
          },
          { id: mgrIT.user_id, role: 'MANAGER' }
        )
      ).rejects.toThrow(/Employee management denied/)
    })

    it('Test 3.3: blocks Manager from cross-department employee check-in via REST', async () => {
      const mgrIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_IT')!
      const staffHR = state.allEmployees.find((e: any) => e.employee_code === 'EMP_STAFF_HR')!
      await expect(
        checkIn(
          {
            employeeId: staffHR.id,
            method: 'MANUAL',
            reason: 'Hỗ trợ',
          },
          { id: mgrIT.user_id, role: 'MANAGER' }
        )
      ).rejects.toThrow(/Employee management denied/)
    })
  })

  describe('4. Post-Early Settlement Hardware Face Scan (Scenario 4)', () => {
    it('marks an active employee scan as FLAGGED when that payroll period is already finalized', async () => {
      // Setup: Employee A finalized for 2026-10 with early settlement on Oct 15
      state.record = {
        id: BigInt(1),
        employeeId: state.employee.id,
        payroll_period: '2026-10',
        status: 'FINALIZED',
        total_working_hours: 9,
        net_salary: 2400000,
        calculation_details: {
          early_settlement: {
            is_early_settlement: true,
            cutoff_date: '2026-10-15',
          },
        },
      }

      // At 17:00 on Oct 15, verified face scan arrives from device
      const scanTime = new Date('2026-10-15T17:00:00+07:00')
      vi.setSystemTime(scanTime)

      await checkIn(
        {
          employeeId: state.employee.id,
          device_info: 'device:PI_CAMERA_GATE_01',
        },
        undefined, // Hardware / Webhook origin
        {
          verified: true,
          capturedAt: scanTime.getTime(),
          deviceId: 'PI_CAMERA_GATE_01',
          verificationScore: 0.95,
          livenessScore: 0.98,
        }
      )

      // 1. Log must be FLAGGED because payroll is already closed/FINALIZED
      const createdLog = state.attendanceLogs.at(-1)
      expect(createdLog).toBeDefined()
      expect(createdLog.status).toBe('FLAGGED')
      expect(createdLog.method).toBe('FACE')
      expect(createdLog.device_info).toBe('device:PI_CAMERA_GATE_01')

      // 2. Finalized payroll record remains completely intact
      expect(state.record.status).toBe('FINALIZED')
      expect(state.record.total_working_hours).toBe(9)
      expect(state.record.net_salary).toBe(2400000)
    })

    it('returns a denial contract for a FLAGGED scan without modifying finalized wages', async () => {
      // Setup: Employee A finalized for 2026-10 with early settlement on Oct 10
      state.record = {
        id: BigInt(1),
        employeeId: state.employee.id,
        payroll_period: '2026-10',
        status: 'FINALIZED',
        total_working_hours: 9,
        net_salary: 2400000,
        calculation_details: {
          early_settlement: {
            is_early_settlement: true,
            cutoff_date: '2026-10-10',
          },
        },
      }

      // On Oct 15 (after early settlement), employee walks up to the Pi hardware gate and scans face
      const scanTime = new Date('2026-10-15T17:00:00+07:00')
      vi.setSystemTime(scanTime)

      const webhookPayload = {
        device_id: 'PI4_FRONT_GATE',
        mode: 'CHECK_IN',
        event_id: 'scan_hardware_after_early_settlement_001',
        expected_employee_id: state.employee.id,
        antispoof_score: 0.98,
        embedding: new Array(512).fill(0.04419), // 512 float32 with norm ~ 1.0
        client_timestamp: scanTime.getTime(),
      }

      // Frame 1: Intermediate verify frame (verification_only: true)
      const v1 = await handleThingsBoardWebhook({
        ...webhookPayload,
        event_kind: 'VERIFY_ONLY',
        recognition_id: 'recog_hardware_001',
      })
      expect(v1.success).toBe(true)
      expect((v1 as any).verification_only).toBe(true)
      expect((v1 as any).confirmation_count).toBe(1)

      // Frame 2: Second intermediate verify frame
      const v2 = await handleThingsBoardWebhook({
        ...webhookPayload,
        event_kind: 'VERIFY_ONLY',
        recognition_id: 'recog_hardware_002',
      })
      expect(v2.success).toBe(true)
      expect((v2 as any).verification_only).toBe(true)
      expect((v2 as any).confirmation_count).toBe(2)

      // Frame 3: Final confirmed scan (attempts to commit attendance)
      const response = await handleThingsBoardWebhook({
        ...webhookPayload,
        event_kind: 'CONFIRMED_SCAN',
        recognition_id: 'recog_hardware_003',
      })

      // 1. Hardware Pi MUST receive success: false and door_open: false so servo/relay does NOT open
      expect(response.success).toBe(false)
      expect((response as any).door_open).toBe(false)
      expect((response as any).code).toBe(403)
      expect(response.message).toMatch(/Kỳ công đã chốt hoặc nhân viên đã quyết toán nghỉ việc; điểm danh bị gắn cờ và từ chối mở cửa/)

      // 2. Employee was identified by vector search so Pi TFT shows employee name + denial reason
      expect(response.matched).toBe(true)
      expect(response.employee?.id).toBe(state.employee.id)

      // 3. Attendance log in DB is saved with FLAGGED status for security audit
      expect(response.attendance?.status).toBe('FLAGGED')
      const createdLog = state.attendanceLogs.at(-1)
      expect(createdLog).toBeDefined()
      expect(createdLog.status).toBe('FLAGGED')
      expect(createdLog.method).toBe('FACE')
      expect(createdLog.device_info).toBe('device:PI4_FRONT_GATE')

      // 4. Finalized payroll record remains completely intact (wages not affected)
      expect(state.record.status).toBe('FINALIZED')
      expect(state.record.total_working_hours).toBe(9)
      expect(state.record.net_salary).toBe(2400000)
    })
  })

  describe('5. Face Verification Bypass Prevention & Method Security', () => {
    it('rejects FACE method at REST DTO validation level', () => {
      const parsed = checkInSchema.safeParse({
        employeeId: state.employee.id,
        method: 'FACE',
      })
      expect(parsed.success).toBe(false)
    })

    it('forces MANUAL and unverified when caller passes method: FACE directly to service', async () => {
      const result = await checkIn(
        {
          employeeId: state.employee.id,
          method: 'FACE' as any,
          reason: 'Quên quét mặt',
        },
        manager
      )

      expect(result.method).toBe('MANUAL')
      const createdLog = state.attendanceLogs.at(-1)
      expect(createdLog.method).toBe('MANUAL')
      expect(createdLog.status).toBe('VALID')

      const audit = state.auditLogs.find((a) => a.action === 'MANUAL_ATTENDANCE_CHECK_IN')
      expect(audit).toBeDefined()
      expect(audit?.userId).toBe(manager.id)
    })

    it('supports legitimate alternative manual methods (CARD, FINGERPRINT)', async () => {
      const result = await checkIn(
        {
          employeeId: state.employee.id,
          method: 'CARD',
          reason: 'Quẹt thẻ phụ do camera bảo trì',
        },
        manager
      )

      expect(result.method).toBe('CARD')
      const createdLog = state.attendanceLogs.at(-1)
      expect(createdLog.method).toBe('CARD')
    })
  })

  describe('6. Dev Simulation Audit Trail & Access Control (Scenario 6)', () => {
    it('rejects simulation in production even if the override is set', async () => {
      process.env.NODE_ENV = 'production'
      process.env.ALLOW_DEV_SIMULATION = 'true'
      await expect(devSimulateFaceScan({ employeeId: state.employee.id }, admin)).rejects.toThrow()
      delete process.env.ALLOW_DEV_SIMULATION
    })
    it('devSimulateFaceScan creates verified FACE attendance and records DEV_SIMULATE_FACE_SCAN audit log in dev mode', async () => {
      process.env.NODE_ENV = 'development'
      const staffIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_STAFF_IT')!
      const mgrIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_IT')!

      const result = await devSimulateFaceScan(
        {
          employeeId: staffIT.id,
          mode: 'CHECK_IN',
          antispoof_score: 0.96,
          verification_score: 0.94,
        },
        { id: mgrIT.user_id, role: 'MANAGER' }
      )

      expect(result.method).toBe('FACE')
      const createdLog = state.attendanceLogs.at(-1)
      expect(createdLog.method).toBe('FACE')
      expect(createdLog.verification_score).toBe(0.94)
      expect(createdLog.liveness_score).toBe(0.96)

      // Scenario 6 Assertion: Must create an auditLog entry clearly tagging simulation
      const simAudit = state.auditLogs.find((a) => a.action === 'DEV_SIMULATE_FACE_SCAN')
      expect(simAudit).toBeDefined()
      expect(simAudit?.userId).toBe(mgrIT.user_id)
      expect(simAudit?.new_values?.is_simulation).toBe(true)
      expect(simAudit?.new_values?.reason).toContain('Developer Face Simulation')
    })

    it('devSimulateFaceScan is forbidden in production without an override', async () => {
      process.env.NODE_ENV = 'production'
      delete process.env.ALLOW_DEV_SIMULATION

      const staffIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_STAFF_IT')!
      const mgrIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_IT')!

      await expect(
        devSimulateFaceScan(
          {
            employeeId: staffIT.id,
            mode: 'CHECK_IN',
          },
          { id: mgrIT.user_id, role: 'MANAGER' }
        )
      ).rejects.toThrow(/môi trường thử nghiệm/)
    })

    it('blocks MANAGER from self-action on devSimulateFaceScan', async () => {
      process.env.NODE_ENV = 'development'
      const mgrIT = state.allEmployees.find((e: any) => e.employee_code === 'EMP_MGR_IT')!

      await expect(
        devSimulateFaceScan(
          {
            employeeId: mgrIT.id,
            mode: 'CHECK_IN',
          },
          { id: mgrIT.user_id, role: 'MANAGER' }
        )
      ).rejects.toThrow(/Quản lý không được tự thực hiện giả lập quét mặt cho chính mình/)
    })
  })

  it('does not finalize early while the cutoff shift is still running', async () => {
    state.shifts = [{ employee_id: state.employee.id, work_date: new Date('2026-10-15T00:00:00Z'), start_time: null, end_time: null, work_shifts: { start_time: '08:00', end_time: '17:00' } }]
    await expect(finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-15', reason: 'Nghỉ việc' }, admin.id, admin.role)).rejects.toThrow(/ca chưa kết thúc/)
    expect(state.record.status).toBe('PENDING')
  })

  it('does not finalize early with unreconciled manual hours', async () => {
    state.record.calculation_details = { ...state.record.calculation_details, manual: true }
    await expect(finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)).rejects.toThrow(/đối chiếu/)
    expect(state.record.status).toBe('PENDING')
  })

  it('retains an audit trail of pending adjustments removed after the cutoff', async () => {
    state.adjustments = [{ id: 7n, employee_id: state.employee.id, work_date: new Date('2026-10-16T00:00:00Z'), kind: 'ABSENCE', status: 'PENDING', amount: 250000, hours: 0 }]
    await finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)
    const audit = state.auditLogs.find(a => a.action === 'FINALIZE_EARLY_SETTLEMENT')
    expect(audit?.old_values?.removed_adjustments).toEqual(expect.arrayContaining([expect.objectContaining({ id: '7', kind: 'ABSENCE', amount: 250000, status: 'PENDING' })]))
  })

  it('terminates the employee immediately when early settlement succeeds', async () => {
    await finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)
    expect(state.employee.status).toBe('TERMINATED')
    await expect(checkIn({ employeeId: state.employee.id, method: 'MANUAL' }, admin)).rejects.toThrow(/ACTIVE/)
  })

  it('removes and audits scheduled shifts in subsequent months after settlement', async () => {
    state.shifts = [{ id: 9n, employee_id: state.employee.id, work_date: new Date('2026-11-01T00:00:00Z'), shift_type: 'NORMAL', start_time: '08:00', end_time: '17:00' }]
    await finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)
    expect(state.shifts).toHaveLength(0)
    expect(state.auditLogs.find(a => a.action === 'FINALIZE_EARLY_SETTLEMENT')?.old_values?.removed_shifts).toEqual(expect.arrayContaining([expect.objectContaining({ id: '9' })]))
  })

  it('rejects a cutoff before actual work without deleting summaries or terminating the employee', async () => {
    const original = [...state.summaries]
    await expect(finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-10', reason: 'Nghỉ việc' }, admin.id, admin.role)).rejects.toThrow(/sau ngày quyết toán/)
    expect(state.summaries).toEqual(original)
    expect(state.employee.status).toBe('ACTIVE')
    expect(state.record.status).toBe('PENDING')
  })

  it('previews the conflicting dates and worked hours without changing payroll or employment', async () => {
    const preview = await previewEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-10', reason: 'Nghỉ việc' }, admin.id, admin.role)
    expect(preview).toMatchObject({ blocked: true, conflict_dates: ['2026-10-14'], worked_hours_after_cutoff: 8 })
    expect(state.summaries).toHaveLength(1)
    expect(state.record.status).toBe('PENDING')
    expect(state.employee.status).toBe('ACTIVE')
  })

  it('rejects a cutoff before an approved adjustment even when there are no worked hours after it', async () => {
    state.adjustments = [{ id: 7n, employee_id: state.employee.id, work_date: new Date('2026-10-16T00:00:00Z'), kind: 'ABSENCE', status: 'APPROVED', amount: 250000, hours: 0 }]
    await expect(finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)).rejects.toThrow(/sau ngày quyết toán/)
    expect(state.adjustments).toHaveLength(1)
    expect(state.record.status).toBe('PENDING')
  })

  it('rejects actual scans after cutoff in a later month even without summaries', async () => {
    vi.setSystemTime(new Date('2026-11-03T10:00:00+07:00'))
    state.attendanceLogs = [{ id: 1n, employee_id: state.employee.id, type: 'CHECK_IN', status: 'VALID', work_date: new Date('2026-11-02T00:00:00Z'), event_time: new Date('2026-11-02T08:00:00+07:00') }]
    await expect(finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)).rejects.toThrow(/sau ngày quyết toán/)
    expect(state.employee.status).toBe('ACTIVE')
  })

  it('keeps early-settled payroll finalized when unlocking the rest of the period', async () => {
    state.record.status = 'FINALIZED'
    state.record.calculation_details = { early_settlement: { is_early_settlement: true, cutoff_date: '2026-10-14' } }
    await unlockPeriod('2026-10', admin.id)
    expect(state.record.status).toBe('FINALIZED')
    expect(state.record.calculation_details.early_settlement.cutoff_date).toBe('2026-10-14')
  })

  it('uses the fresh employee wage after acquiring the settlement transaction lock', async () => {
    const transaction = vi.spyOn(prisma, '$transaction')
    transaction.mockImplementationOnce((async (work: any) => {
      state.employee = { ...state.employee, hourly_rate: 120000 }
      return work(prisma)
    }) as any)
    try {
      const result = await finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)
      expect(Number(result.hourly_rate)).toBe(120000)
      expect(Number(result.net_salary)).toBe(2460000)
    } finally { transaction.mockRestore() }
  })

  it('allows an overnight cutoff when legacy scans have no work_date and checkout is the next morning', async () => {
    state.shifts = [{ employee_id: state.employee.id, work_date: new Date('2026-10-14T00:00:00Z'), start_time: '22:00', end_time: '06:00', shift_type: 'OTHER' }]
    state.attendanceLogs = [
      { id: 1n, employee_id: state.employee.id, type: 'CHECK_IN', status: 'VALID', work_date: null, event_time: new Date('2026-10-14T22:00:00+07:00') },
      { id: 2n, employee_id: state.employee.id, type: 'CHECK_OUT', status: 'VALID', work_date: null, event_time: new Date('2026-10-15T06:00:00+07:00') },
    ]
    const result = await finalizeEarlySettlement({ employeeId: state.employee.id, period: '2026-10', cutoffDate: '2026-10-14', reason: 'Nghỉ việc' }, admin.id, admin.role)
    expect(result.status).toBe('FINALIZED')
    expect(Number(result.total_working_hours)).toBe(8)
  })
})
