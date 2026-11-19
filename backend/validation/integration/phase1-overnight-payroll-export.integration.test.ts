import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'

const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
const suite = enabled ? describe : describe.skip

suite('Phase 1 Neon PostgreSQL integration: overnight work_date & scoped payroll export', () => {
  let db: any
  let attendance: any
  let payroll: any
  let payrollExport: any

  let deptIt: any
  let deptHr: any
  let managerItUser: any
  let managerItEmp: any
  let staffItEmp: any
  let futureStaffItEmp: any
  let managerHrEmp: any
  let staffHrEmp: any
  let adminUser: any

  beforeAll(async () => {
    await import('../../src/composition.js')
    db = (await import('../../src/config/database.js')).prisma
    attendance = await import('../../src/modules/attendance/attendance.service.js')
    payroll = await import('../../src/modules/payroll/payroll.service.js')
    payrollExport = await import('../../src/modules/payroll/payroll.export.js')

    await ensureTestPayrollPolicy(db)

    const adminRole = await db.roles.upsert({ where: { role_name: 'ADMIN' }, create: { role_name: 'ADMIN' }, update: {} })
    const managerRole = await db.roles.upsert({ where: { role_name: 'MANAGER' }, create: { role_name: 'MANAGER' }, update: {} })
    const empRole = await db.roles.upsert({ where: { role_name: 'EMPLOYEE' }, create: { role_name: 'EMPLOYEE' }, update: {} })

    deptIt = await db.department.create({ data: { department_code: `IT-${randomUUID().slice(0, 6)}`, name: 'Phòng IT Test' } })
    deptHr = await db.department.create({ data: { department_code: `HR-${randomUUID().slice(0, 6)}`, name: 'Phòng HR Test' } })

    const posMgrIt = await db.position.create({ data: { position_code: `PMIT-${randomUUID().slice(0, 6)}`, name: 'Trưởng phòng IT', level: 'MANAGER', departmentId: deptIt.id } })
    const posStaffIt = await db.position.create({ data: { position_code: `PSIT-${randomUUID().slice(0, 6)}`, name: 'Kỹ sư IT', level: 'EMPLOYEE', departmentId: deptIt.id } })
    const posMgrHr = await db.position.create({ data: { position_code: `PMHR-${randomUUID().slice(0, 6)}`, name: 'Trưởng phòng HR', level: 'MANAGER', departmentId: deptHr.id } })
    const posStaffHr = await db.position.create({ data: { position_code: `PSHR-${randomUUID().slice(0, 6)}`, name: 'Chuyên viên HR', level: 'EMPLOYEE', departmentId: deptHr.id } })

    adminUser = await db.user.create({ data: { username: `adm-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: adminRole.id } })
    managerItUser = await db.user.create({ data: { username: `mit-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: managerRole.id } })
    const staffItUser = await db.user.create({ data: { username: `sit-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: empRole.id } })
    const futureItUser = await db.user.create({ data: { username: `fit-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: empRole.id } })
    const managerHrUser = await db.user.create({ data: { username: `mhr-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: managerRole.id } })
    const staffHrUser = await db.user.create({ data: { username: `shr-${randomUUID().slice(0, 8)}`, passwordHash: 'test-only', role_id: empRole.id } })

    managerItEmp = await db.employee.create({
      data: {
        employee_code: `M-IT-${randomUUID().slice(0, 6)}`,
        full_name: 'Quản Lý IT',
        user_id: managerItUser.id,
        departmentId: deptIt.id,
        positionId: posMgrIt.id,
        hourly_rate: 150000,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    })
    staffItEmp = await db.employee.create({
      data: {
        employee_code: `S-IT-${randomUUID().slice(0, 6)}`,
        full_name: 'Nhân Viên IT',
        user_id: staffItUser.id,
        departmentId: deptIt.id,
        positionId: posStaffIt.id,
        hourly_rate: 100000,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    })
    futureStaffItEmp = await db.employee.create({
      data: {
        employee_code: `F-IT-${randomUUID().slice(0, 6)}`,
        full_name: 'Nhân Viên Mới IT',
        user_id: futureItUser.id,
        departmentId: deptIt.id,
        positionId: posStaffIt.id,
        hourly_rate: 100000,
        createdAt: new Date('2026-11-05T00:00:00Z'),
      },
    })
    managerHrEmp = await db.employee.create({
      data: {
        employee_code: `M-HR-${randomUUID().slice(0, 6)}`,
        full_name: 'Quản Lý HR',
        user_id: managerHrUser.id,
        departmentId: deptHr.id,
        positionId: posMgrHr.id,
        hourly_rate: 150000,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    })
    staffHrEmp = await db.employee.create({
      data: {
        employee_code: `S-HR-${randomUUID().slice(0, 6)}`,
        full_name: 'Nhân Viên HR',
        user_id: staffHrUser.id,
        departmentId: deptHr.id,
        positionId: posStaffHr.id,
        hourly_rate: 100000,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
    })
  })

  afterAll(async () => {
    if (db) await db.$disconnect()
  })

  it('filters and formats overnight shift logs strictly by backend work_date and preserves work_date: null fallback on real PostgreSQL', async () => {
    const nightShift = await db.work_shifts.create({
      data: {
        shift_name: `Night-${randomUUID().slice(0, 6)}`,
        start_time: new Date('1970-01-01T22:00:00Z'),
        end_time: new Date('1970-01-01T06:00:00Z'),
      },
    })
    await db.employee_shifts.create({
      data: {
        employee_id: staffItEmp.id,
        shift_id: nightShift.id,
        work_date: new Date('2026-10-15T00:00:00Z'),
        shift_type: 'NIGHT',
        start_time: nightShift.start_time,
        end_time: nightShift.end_time,
      },
    })

    await db.attendance_logs.createMany({
      data: [
        {
          employee_id: staffItEmp.id,
          work_date: new Date('2026-10-15T00:00:00Z'),
          event_time: new Date('2026-10-15T22:05:00+07:00'),
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
        },
        {
          employee_id: staffItEmp.id,
          work_date: new Date('2026-10-15T00:00:00Z'),
          event_time: new Date('2026-10-16T06:10:00+07:00'),
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
        },
        {
          employee_id: staffItEmp.id,
          work_date: null,
          event_time: new Date('2026-10-16T10:00:00+07:00'),
          type: 'CHECK_IN',
          method: 'MANUAL',
          status: 'VALID',
        },
      ],
    })

    const adminActor = { id: adminUser.id, role: 'ADMIN' }

    const day15 = await attendance.list(
      { employeeId: staffItEmp.id, startDate: '2026-10-15', endDate: '2026-10-15', limit: 20 },
      adminActor,
    )
    expect(day15).toHaveLength(2)
    expect(day15.every((row: any) => row.work_date === '2026-10-15')).toBe(true)
    expect(day15.map((row: any) => row.type).sort()).toEqual(['CHECK_IN', 'CHECK_OUT'])

    const day16 = await attendance.list(
      { employeeId: staffItEmp.id, startDate: '2026-10-16', endDate: '2026-10-16', limit: 20 },
      adminActor,
    )
    expect(day16).toHaveLength(1)
    expect(day16[0].work_date).toBeNull()
    expect(day16[0].type).toBe('CHECK_IN')
  })

  it('enforces single-source can_edit authority, hire-period filtering, and scoped official payroll export on real PostgreSQL', async () => {
    const period = '2026-10'
    const managerItActor = { id: managerItUser.id, role: 'MANAGER' }

    const recMgrIt = await db.payrollRecord.create({
      data: {
        employeeId: managerItEmp.id,
        payroll_period: period,
        hourly_rate: 150000,
        total_working_hours: 160,
        net_salary: 24000000,
        status: 'PENDING',
      },
    })
    const recStaffIt = await db.payrollRecord.create({
      data: {
        employeeId: staffItEmp.id,
        payroll_period: period,
        hourly_rate: 100000,
        total_working_hours: 160,
        net_salary: 16000000,
        status: 'PENDING',
      },
    })
    await db.payrollRecord.create({
      data: {
        employeeId: futureStaffItEmp.id,
        payroll_period: period,
        hourly_rate: 100000,
        total_working_hours: 0,
        net_salary: 0,
        status: 'PENDING',
      },
    })
    const recStaffHr = await db.payrollRecord.create({
      data: {
        employeeId: staffHrEmp.id,
        payroll_period: period,
        hourly_rate: 100000,
        total_working_hours: 160,
        net_salary: 16000000,
        status: 'PAID',
      },
    })
    await db.payrollRecord.create({
      data: {
        employeeId: managerHrEmp.id,
        payroll_period: period,
        hourly_rate: 150000,
        total_working_hours: 160,
        net_salary: 24000000,
        status: 'PAID',
      },
    })

    // 1. Manager IT list scope: sees self (can_edit: false) and IT staff (can_edit: true); excludes HR and pre-hire PENDING
    const listed = await payroll.list(period, undefined, managerItActor)
    expect(listed.map((r: any) => ({ employeeId: r.employee_id, can_edit: r.can_edit })).sort((a: any, b: any) => a.employeeId.localeCompare(b.employeeId))).toEqual(
      [
        { employeeId: managerItEmp.employee_code, can_edit: false },
        { employeeId: staffItEmp.employee_code, can_edit: true },
      ].sort((a, b) => a.employeeId.localeCompare(b.employeeId)),
    )

    // 2. Official export rejects while period has PENDING payslips in actor scope (409)
    await expect(
      payrollExport.buildPayrollExport(period, managerItActor, [String(recStaffIt.id)]),
    ).rejects.toMatchObject({ statusCode: 409 })

    // 3. Finalize period (close regular records in IT scope)
    await db.payrollRecord.updateMany({
      where: { id: { in: [recMgrIt.id, recStaffIt.id] } },
      data: { status: 'FINALIZED' },
    })
    await db.payrollRecord.deleteMany({
      where: { employeeId: futureStaffItEmp.id, payroll_period: period },
    })

    // 4. Scoped export returns exact filtered subset inside actor scope and drops out-of-scope HR ID
    const exported = await payrollExport.buildPayrollExport(period, managerItActor, [
      String(recStaffIt.id),
      String(recStaffHr.id),
    ])
    expect(exported).toHaveLength(1)
    expect(exported[0]).toMatchObject({
      id: String(recStaffIt.id),
      employee_id: staffItEmp.employee_code,
      employee_name: 'Nhân Viên IT',
      status: 'FINALIZED',
      can_edit: false,
    })

    // 5. Requesting only out-of-scope IDs returns 404; invalid input returns 400
    await expect(
      payrollExport.buildPayrollExport(period, managerItActor, [String(recStaffHr.id)]),
    ).rejects.toMatchObject({ statusCode: 404 })
    await expect(
      payrollExport.buildPayrollExport('bad-period', managerItActor, [String(recStaffIt.id)]),
    ).rejects.toMatchObject({ statusCode: 400 })
    await expect(
      payrollExport.buildPayrollExport(period, managerItActor, []),
    ).rejects.toMatchObject({ statusCode: 400 })
  })
})
