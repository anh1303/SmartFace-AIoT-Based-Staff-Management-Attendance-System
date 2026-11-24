import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  payrollFindMany: vi.fn(),
  getEmployeeScope: vi.fn(),
  getManagedEmployeeIds: vi.fn(),
  assertCanAccessEmployeeDetail: vi.fn(),
  findDailyAttendanceSummariesForPayroll: vi.fn(),
  findAttendanceAdjustments: vi.fn(),
  getEmployeeShiftsForDateRange: vi.fn(),
}))

vi.mock('../../config/database.js', () => ({
  prisma: {
    payrollRecord: {
      findMany: mocks.payrollFindMany,
    },
  },
}))

vi.mock('../../modules/employees/public.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/employees/public.js')>()
  return {
    ...actual,
    getEmployeeScope: mocks.getEmployeeScope,
    getManagedEmployeeIds: mocks.getManagedEmployeeIds,
    assertCanAccessEmployeeDetail: mocks.assertCanAccessEmployeeDetail,
  }
})

vi.mock('../../modules/attendance/public.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/attendance/public.js')>()
  return {
    ...actual,
    findDailyAttendanceSummariesForPayroll: mocks.findDailyAttendanceSummariesForPayroll,
    findAttendanceAdjustments: mocks.findAttendanceAdjustments,
  }
})

vi.mock('../../modules/shifts/public.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../modules/shifts/public.js')>()
  return {
    ...actual,
    getEmployeeShiftsForDateRange: mocks.getEmployeeShiftsForDateRange,
  }
})

import * as payrollService from '../../modules/payroll/payroll.service.js'
import { workingHoursFingerprint } from '../../modules/payroll/payroll.overrides.js'

const normalizeJson = (val: unknown) => JSON.parse(JSON.stringify(val))

function projectSummaryRow(fullRow: any) {
  const details = fullRow.calculation_details
  let projectedDetails: Record<string, unknown> | null = null
  if (details && typeof details === 'object') {
    projectedDetails = {}
    if (details.scheduledEnd !== undefined && details.scheduledEnd !== null) {
      projectedDetails.scheduledEnd = details.scheduledEnd
    }
    if (details.fingerprint !== undefined && details.fingerprint !== null) {
      projectedDetails.fingerprint = details.fingerprint
    }
  }
  return {
    id: fullRow.id,
    employee_id: fullRow.employee_id,
    work_date: fullRow.work_date,
    total_working_hours: fullRow.total_working_hours,
    overtime: fullRow.overtime,
    late_early: fullRow.late_early,
    overtime_status: fullRow.overtime_status,
    review_status: fullRow.review_status,
    policy_version: fullRow.policy_version,
    requires_review: fullRow.requires_review,
    calculation_details: projectedDetails,
  }
}

function expectedSummaryFingerprint(rows: Array<{
  id: bigint
  total_working_hours: unknown
  overtime: unknown
  late_early: unknown
  overtime_status: string
  review_status?: string
  policy_version: string | null
  requires_review: boolean
  calculation_details: unknown
}>) {
  return createHash('sha256')
    .update(
      JSON.stringify(
        [...rows]
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .map((r) => [
            String(r.id),
            String(r.total_working_hours),
            String(r.overtime),
            String(r.late_early),
            r.overtime_status,
            r.review_status ?? 'NONE',
            r.policy_version,
            r.requires_review,
            (r.calculation_details as Record<string, unknown> | null)?.fingerprint,
          ]),
      ),
    )
    .digest('hex')
}

describe('Task 6 & Task 4 - Payroll list projection & normalized JSON contract across ADMIN/MANAGER/EMPLOYEE', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getEmployeeScope.mockResolvedValue({})
    mocks.assertCanAccessEmployeeDetail.mockResolvedValue(undefined)
    mocks.findAttendanceAdjustments.mockResolvedValue([])
    mocks.getEmployeeShiftsForDateRange.mockResolvedValue([])
  })

  it('produces 100% identical normalized JSON between full summary rows and projected summary rows across null JSON, missing fingerprint, and overnight shifts', async () => {
    const fullSummaries = [
      // 1. Normal day with heavy calculation_details blob
      {
        id: 101n,
        employee_id: 'emp-1',
        work_date: new Date('2026-10-10T00:00:00.000Z'),
        total_working_hours: new Prisma.Decimal('8.00'),
        overtime: new Prisma.Decimal('1.50'),
        late_early: new Prisma.Decimal('0.00'),
        overtime_status: 'APPROVED',
        review_status: 'APPROVED',
        policy_version: 'v2',
        requires_review: false,
        pre_approval_snapshot: { huge: 'blob'.repeat(200) },
        calculation_details: {
          scheduledStart: '2026-10-10T01:00:00.000Z',
          scheduledEnd: '2026-10-10T10:00:00.000Z',
          fingerprint: 'fp-day-10',
          pairs: [{ start: '2026-10-10T01:00:00Z', end: '2026-10-10T10:00:00Z' }],
        },
      },
      // 2. Null calculation_details
      {
        id: 102n,
        employee_id: 'emp-1',
        work_date: new Date('2026-10-11T00:00:00.000Z'),
        total_working_hours: new Prisma.Decimal('4.00'),
        overtime: new Prisma.Decimal('0.00'),
        late_early: new Prisma.Decimal('0.50'),
        overtime_status: 'NONE',
        review_status: 'APPROVED',
        policy_version: 'v2',
        requires_review: false,
        calculation_details: null,
      },
      // 3. Missing fingerprint inside calculation_details
      {
        id: 103n,
        employee_id: 'emp-1',
        work_date: new Date('2026-10-12T00:00:00.000Z'),
        total_working_hours: new Prisma.Decimal('8.00'),
        overtime: new Prisma.Decimal('0.00'),
        late_early: new Prisma.Decimal('0.00'),
        overtime_status: 'NONE',
        review_status: 'APPROVED',
        policy_version: 'v2',
        requires_review: false,
        calculation_details: {
          scheduledEnd: '2026-10-12T10:00:00.000Z',
        },
      },
      // 4. Overnight shift finishing next morning (elapsed) vs future unfinished overnight shift (excluded)
      {
        id: 104n,
        employee_id: 'emp-1',
        work_date: new Date('2026-10-13T00:00:00.000Z'),
        total_working_hours: new Prisma.Decimal('8.00'),
        overtime: new Prisma.Decimal('0.00'),
        late_early: new Prisma.Decimal('0.00'),
        overtime_status: 'NONE',
        review_status: 'APPROVED',
        policy_version: 'v2',
        requires_review: false,
        calculation_details: {
          scheduledStart: '2026-10-13T15:00:00.000Z',
          scheduledEnd: '2026-10-13T23:00:00.000Z',
          fingerprint: 'fp-overnight-done',
        },
      },
      {
        id: 105n,
        employee_id: 'emp-1',
        work_date: new Date('2026-10-14T00:00:00.000Z'),
        total_working_hours: new Prisma.Decimal('3.00'),
        overtime: new Prisma.Decimal('0.00'),
        late_early: new Prisma.Decimal('0.00'),
        overtime_status: 'NONE',
        review_status: 'PENDING',
        policy_version: 'v2',
        requires_review: true,
        calculation_details: {
          scheduledStart: '2099-10-14T15:00:00.000Z',
          scheduledEnd: '2099-10-14T23:00:00.000Z',
          fingerprint: 'fp-overnight-unfinished',
        },
      },
    ]

    const elapsedRows = fullSummaries.slice(0, 4)
    const matchingSourceFp = expectedSummaryFingerprint(elapsedRows)
    const matchingHoursFp = workingHoursFingerprint(elapsedRows)
    const emptyAdjFp = createHash('sha256').update('[]').digest('hex')

    const makePayrollRow = () => ({
      id: 1n,
      payroll_period: '2026-10',
      employeeId: 'emp-1',
      hourly_rate: new Prisma.Decimal('50000'),
      total_working_hours: new Prisma.Decimal('28'),
      total_overtime: new Prisma.Decimal('1.5'),
      total_late_early: new Prisma.Decimal('0.5'),
      total_absence_penalty: new Prisma.Decimal('0'),
      allowance: new Prisma.Decimal('100000'),
      net_salary: new Prisma.Decimal('1575000'),
      status: 'PENDING',
      overtime_rate: new Prisma.Decimal('1.5'),
      late_penalty_rate: new Prisma.Decimal('0.5'),
      updated_at: new Date('2026-10-15T00:00:00.000Z'),
      calculation_details: {
        source_fingerprint: matchingSourceFp,
        adjustment_fingerprint: emptyAdjFp,
        field_overrides: {
          working_hours: { value: 28, basis_fingerprint: matchingHoursFp, reason: 'ok' },
        },
      },
      employee: {
        employee_code: 'EMP-001',
        full_name: 'Nguyen Van A',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        hourly_rate: new Prisma.Decimal('50000'),
        hourly_rate_history: [],
        department: { name: 'Engineering' },
      },
    })

    // Run with FULL rows vs PROJECTED rows as ADMIN
    mocks.payrollFindMany.mockResolvedValueOnce([makePayrollRow()])
    mocks.findDailyAttendanceSummariesForPayroll.mockResolvedValueOnce(fullSummaries as any)
    const adminFromFull = await payrollService.list('2026-10', undefined, { id: 'admin-1', role: 'ADMIN' })

    mocks.payrollFindMany.mockResolvedValueOnce([makePayrollRow()])
    mocks.findDailyAttendanceSummariesForPayroll.mockResolvedValueOnce(fullSummaries.map(projectSummaryRow))
    const adminFromProjected = await payrollService.list('2026-10', undefined, { id: 'admin-1', role: 'ADMIN' })

    expect(mocks.getManagedEmployeeIds).not.toHaveBeenCalled()
    expect(normalizeJson(adminFromProjected)).toEqual(normalizeJson(adminFromFull))
    expect(adminFromProjected[0]).toMatchObject({
      can_edit: true,
      requires_reconciliation: false,
      needs_recalculation: false,
    })

    // Verify lightweight employee select
    const findManyArg = mocks.payrollFindMany.mock.calls[0][0]
    expect(findManyArg.include.employee).toEqual({
      select: {
        employee_code: true,
        full_name: true,
        createdAt: true,
        hourly_rate: true,
        hourly_rate_history: true,
        department: { select: { name: true } },
      },
    })
  })

  it('enforces can_edit contract across MANAGER (managed vs unmanaged) and EMPLOYEE (always false)', async () => {
    const baseRow = (id: bigint, empId: string, code: string) => ({
      id,
      payroll_period: '2026-10',
      employeeId: empId,
      hourly_rate: new Prisma.Decimal('50000'),
      total_working_hours: new Prisma.Decimal('8'),
      total_overtime: new Prisma.Decimal('0'),
      total_late_early: new Prisma.Decimal('0'),
      total_absence_penalty: new Prisma.Decimal('0'),
      allowance: new Prisma.Decimal('0'),
      net_salary: new Prisma.Decimal('400000'),
      status: 'PENDING',
      overtime_rate: new Prisma.Decimal('1.5'),
      late_penalty_rate: new Prisma.Decimal('0.5'),
      updated_at: new Date('2026-10-12T00:00:00.000Z'),
      calculation_details: {},
      employee: {
        employee_code: code,
        full_name: `Emp ${code}`,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        hourly_rate: new Prisma.Decimal('50000'),
        hourly_rate_history: [],
        department: { name: 'Engineering' },
      },
    })

    // MANAGER sees own record (unmanaged) + subordinate record (managed)
    mocks.payrollFindMany.mockResolvedValueOnce([
      baseRow(1n, 'emp-self-mgr', 'MGR-01'),
      baseRow(2n, 'emp-sub', 'EMP-02'),
    ])
    mocks.getManagedEmployeeIds.mockResolvedValueOnce(new Set(['emp-sub']))
    mocks.findDailyAttendanceSummariesForPayroll.mockResolvedValueOnce([])

    const mgrRes = await payrollService.list('2026-10', undefined, { id: 'mgr-1', role: 'MANAGER' })
    expect(mocks.getManagedEmployeeIds).toHaveBeenCalledTimes(1)
    expect(mgrRes.map((r) => ({ code: r.employee_id, can_edit: r.can_edit, needs_recalculation: r.needs_recalculation }))).toEqual([
      { code: 'MGR-01', can_edit: false, needs_recalculation: true },
      { code: 'EMP-02', can_edit: true, needs_recalculation: true },
    ])

    // EMPLOYEE sees own record with can_edit: false
    mocks.payrollFindMany.mockResolvedValueOnce([baseRow(3n, 'emp-self', 'EMP-03')])
    mocks.getManagedEmployeeIds.mockResolvedValueOnce(new Set())
    mocks.findDailyAttendanceSummariesForPayroll.mockResolvedValueOnce([])

    const empRes = await payrollService.list('2026-10', undefined, { id: 'emp-u3', role: 'EMPLOYEE' })
    expect(empRes[0].can_edit).toBe(false)
  })
})
