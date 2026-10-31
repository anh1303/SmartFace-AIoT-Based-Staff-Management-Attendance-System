import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'
import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
import { ensureTestPayrollPolicy } from '../payroll/policy-fixture.js'
const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
const suite = enabled ? describe : describe.skip
suite('Financial and review safety in PostgreSQL', () => {
  let db: any, attendance: any, payroll: any, shifts: any, admin: any
  const prefix = randomUUID().slice(0,8), period = '2026-09'
  const employee = (name: string, extra = {}) => db.employee.create({data:{employee_code:`SAFE-${prefix}-${name}`,full_name:name,hourly_rate:100000,...extra}})
  const raw = (emp: any,type: string,date: string,time: string) => db.attendance_logs.create({data:{employee_id:emp.id,type,event_time:new Date(`${date}T${time}+07:00`),status:'VALID',method:'MANUAL'}})
  beforeAll(async () => {
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-09-30T23:00:00+07:00'))
    db = (await import('../../src/config/database.js')).prisma
    await ensureTestPayrollPolicy(db)
    attendance = await import('../../src/modules/attendance/attendance.service.js')
    payroll = await import('../../src/modules/payroll/payroll.service.js')
    shifts = await import('../../src/modules/shifts/shift.service.js')
    const role = await db.roles.upsert({where:{role_name:'ADMIN'},create:{role_name:'ADMIN'},update:{}})
    admin = await db.user.create({data:{username:`safe-${prefix}`,passwordHash:'test-only',role_id:role.id}})
  })
  afterAll(async () => {vi.useRealTimers();if(db) await db.$disconnect()})
  it('does not fall back to 176 hours or retain stale zero OT/late', async () => {
    const emp = await employee('zero')
    await db.payrollRecord.create({data:{employeeId:emp.id,payroll_period:period,total_working_hours:176,total_overtime:20,total_late_early:10,allowance:0}})
    const [row] = await payroll.generate(period,emp.id,admin.id,{id:admin.id,role:'ADMIN'})
    expect(row.total_working_hours).toBe(0);expect(row.total_overtime).toBe(0);expect(row.total_late_early).toBe(0);expect(row.net_salary).toBe(0)
    await db.payrollRecord.update({where:{id:BigInt(row.id)},data:{status:'PAID'}})
    await expect(payroll.unlockPeriod(period,admin.id)).rejects.toThrow(/đã trả/)
  })
  it('keeps OFF events unpaid, supports manual OT, and changes the shift FK', async () => {
    const emp = await employee('off'), date = '2026-09-12'
    const assigned = await shifts.assignOrUpdateWithPermissionCheck({employee_id:emp.id,date,shift_type:'OFF'}, {id:admin.id,role:'ADMIN'})
    await raw(emp,'CHECK_IN',date,'08:00:00');await raw(emp,'CHECK_OUT',date,'20:00:00')
    await attendance.aggregateDailyAttendance(9,2026,emp.id)
    let summary = await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    expect(Number(summary.total_working_hours)).toBe(0);expect(Number(summary.overtime_candidate_hours)).toBe(0)
    await attendance.adjustAttendance({employeeId:emp.id,date,late_early:0,overtime:3,reason:'Làm thêm ngày OFF'},admin.id,'ADMIN')
    const item = await db.attendanceAdjustment.findFirst({where:{employee_id:emp.id,kind:'OVERTIME'}})
    const adjustments = await import('../../src/modules/payroll/payroll.adjustments.js')
    await adjustments.reviewAdjustment(String(item.id),{status:'APPROVED',note:'Làm thêm OFF',updated_at:item.updated_at.toISOString()},{id:admin.id,role:'ADMIN'})
    await attendance.aggregateDailyAttendance(9,2026,emp.id)
    summary = await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    expect(Number(summary.overtime)).toBe(3)
    const before = await db.employee_shifts.findFirst({where:{employee_id:emp.id}})
    await shifts.assignOrUpdateWithPermissionCheck({employee_id:emp.id,date,shift_type:'OFFICE_HOURS'}, {id:admin.id,role:'ADMIN'})
    const updated = await db.employee_shifts.findFirst({where:{employee_id:emp.id}})
    expect(updated.shift_id).not.toBe(before.shift_id)
    summary = await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    expect(summary.overtime_status).toBe('PENDING');expect(Number(summary.overtime)).toBe(0)
  })
  it('rejects >24h pairs and flags both affected days without fabricated wages', async () => {
    const emp = await employee('over24')
    await raw(emp,'CHECK_IN','2026-09-13','08:00:00');await raw(emp,'CHECK_OUT','2026-09-14','08:00:01')
    await attendance.aggregateDailyAttendance(9,2026,emp.id)
    const rows = await db.daily_attendance_summary.findMany({where:{employee_id:emp.id}})
    expect(rows).toHaveLength(2);expect(rows.every((r: any) => r.requires_review && Number(r.total_working_hours) === 0)).toBe(true)
  })
  it('rolls back OT adjustment if its audit insert fails', async () => {
    const emp = await employee('audit'),date='2026-09-15'
    await shifts.assignOrUpdateWithPermissionCheck({employee_id:emp.id,date,shift_type:'OFF'}, {id:admin.id,role:'ADMIN'})
    await raw(emp,'CHECK_IN',date,'08:00:00');await raw(emp,'CHECK_OUT',date,'10:00:00')
    await attendance.aggregateDailyAttendance(9,2026,emp.id)
    await expect(attendance.adjustAttendance({employeeId:emp.id,date,late_early:0,overtime:5,reason:'Must rollback'},randomUUID(),'ADMIN')).rejects.toThrow()
    const summary = await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    expect(Number(summary.overtime)).toBe(0);expect(summary.overtime_status).toBe('NONE')
  })
  it('enforces manager self/peer/department restrictions in bulk generation', async () => {
    const role = await db.roles.upsert({where:{role_name:'MANAGER'},create:{role_name:'MANAGER'},update:{}})
    const dept = await db.department.create({data:{department_code:`D-${prefix}`,name:'Test Department'}})
    const otherDept = await db.department.create({data:{department_code:`O-${prefix}`,name:'Other Department'}})
    const user = await db.user.create({data:{username:`manager-${prefix}`,passwordHash:'test-only',role_id:role.id}})
    const manager = await employee('self',{user_id:user.id,departmentId:dept.id})
    const staff = await employee('staff',{departmentId:dept.id})
    const outside = await employee('outside',{departmentId:otherDept.id})
    const peerUser = await db.user.create({data:{username:`peer-${prefix}`,passwordHash:'test-only',role_id:role.id}})
    const peer = await employee('peer',{user_id:peerUser.id,departmentId:dept.id})
    const actor = {id:user.id,role:'MANAGER'}
    for (const target of [manager,peer,outside]) await expect(payroll.generate(period,target.id,user.id,actor)).rejects.toThrow()
    const results = await payroll.generate(period,undefined,user.id,actor)
    expect(results.map((r: any) => r.employee_id)).toEqual([staff.employee_code])
  })
})
