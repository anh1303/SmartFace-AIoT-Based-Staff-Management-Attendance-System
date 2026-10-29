import { randomUUID } from 'node:crypto'
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
// This suite must never connect to the workspace/live database. Both URLs are mandatory.
const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled && ![process.env.DATABASE_URL, process.env.DIRECT_URL].every(url => url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55439\/policy_check$/.test(url))) {
  throw new Error('Refusing integration test: both URLs must point to the isolated policy_check database')
}
const suite = enabled ? describe : describe.skip
suite('PostgreSQL policy integration (isolated database only)', () => {
  let db: any, service: any, payroll: any, adjustments: any, emp: any, admin: any
  const date = '2026-10-02', period = '2026-10'
  const at = (time: string) => +new Date(`${date}T${time}+07:00`)
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${date}T22:00:00+07:00`))
    db = (await import('../../src/config/database.js')).prisma
    service = await import('../../src/modules/attendance/attendance.service.js')
    payroll = await import('../../src/modules/payroll/payroll.service.js')
    adjustments = await import('../../src/modules/payroll/payroll.adjustments.js')
    await payroll.updateBonusPenalty({overtime_rate:100000,overtime_rate_kind:'FIXED_PER_HOUR',late_early_penalty:50000,late_early_penalty_kind:'FIXED_PER_HOUR'})
    const role = await db.roles.upsert({ where: { role_name: 'ADMIN' }, create: { role_name: 'ADMIN' }, update: {} })
    admin = await db.user.create({ data: { username: `policy-${randomUUID().slice(0,8)}`, passwordHash: 'test-only', role_id: role.id } })
    emp = await db.employee.create({ data: { employee_code: `TEST-${randomUUID().slice(0,8)}`, full_name: 'Policy Test', hourly_rate: 100000 } })
    const ws = await db.work_shifts.create({ data: { shift_name:'Policy Test Shift', start_time:new Date('1970-01-01T08:00:00Z'),end_time:new Date('1970-01-01T17:30:00Z') } })
    await db.employee_shifts.create({ data: { employee_id:emp.id,shift_id:ws.id,work_date:new Date(`${date}T00:00:00Z`),shift_type:'OFFICE_HOURS',start_time:ws.start_time,end_time:ws.end_time } })
  })
  beforeEach(() => vi.setSystemTime(new Date(`${date}T22:00:00+07:00`)))
  afterAll(async () => { vi.useRealTimers(); if (db) await db.$disconnect() })
  it('deduplicates concurrent transport retries but keeps distinct INs', async () => {
    const capture = { eventId:'same-event-1234',capturedAt:at('08:00:00'),deviceId:`TEST_PI_${emp.id}` }
    const results = await Promise.all([service.checkIn({employeeId:emp.id},undefined,capture),service.checkIn({employeeId:emp.id},undefined,capture)])
    expect(results[0].id).toBe(results[1].id)
    expect(await db.attendance_logs.count({where:{employee_id:emp.id}})).toBe(1)
    await service.checkIn({employeeId:emp.id},undefined,{...capture,eventId:'next-event-1234',capturedAt:at('09:00:00')})
    await service.checkOut(emp.id,undefined,undefined,{...capture,eventId:'out-event-1234',capturedAt:at('18:10:00')})
    const summary = await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    expect(Number(summary.total_working_hours)).toBe(9.5);expect(Number(summary.overtime)).toBe(0)
    expect(summary.overtime_seconds).toBe(2400);expect(Number(summary.overtime_candidate_hours)).toBe(0.5);expect(summary.overtime_status).toBe('PENDING')
  })
  it('requires an approval reason and permits more OT than measured', async () => {
    await expect(service.adjustAttendance({employeeId:emp.id,date,late_early:1,overtime:2,reason:''},admin.id,'ADMIN')).rejects.toThrow()
    await service.adjustAttendance({employeeId:emp.id,date,late_early:1,overtime:2.74,reason:'Sự cố thiếu ghi nhận'},admin.id,'ADMIN')
    const items = await db.attendanceAdjustment.findMany({where:{employee_id:emp.id,status:'PENDING'}})
    for (const item of items) await adjustments.reviewAdjustment(String(item.id),{status:'APPROVED',note:'Đã kiểm tra',updated_at:item.updated_at.toISOString()},{id:admin.id,role:'ADMIN'})
    await service.aggregateDailyAttendance(10,2026,emp.id)
    const summary = await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    expect(summary.overtime_status).toBe('APPROVED');expect(Number(summary.overtime)).toBe(2.5)
    expect(await db.auditLog.count({where:{action:'ADJUST_ATTENDANCE',userId:admin.id}})).toBe(1)
  })
  it('generates zero-safe wages, snapshots rates and blocks stale finalize', async () => {
    const generated = await payroll.generate(period,emp.id,admin.id,{id:admin.id,role:'ADMIN'})
    expect(generated[0].total_working_hours).toBe(9.5);expect(generated[0].total_overtime).toBe(2.5)
    expect(generated[0].net_salary).toBe(2650000)
    await payroll.updateBonusPenalty({overtime_rate:200000,overtime_rate_kind:'FIXED_PER_HOUR',late_early_penalty:80000,late_early_penalty_kind:'FIXED_PER_HOUR'},admin.id)
    await payroll.generate(period,emp.id,admin.id,{id:admin.id,role:'ADMIN'})
    const current = await db.payrollRecord.findFirst({where:{employeeId:emp.id}})
    expect(Number(current.overtime_rate)).toBe(100000)
    await service.adjustAttendance({employeeId:emp.id,date,late_early:1,overtime:1,reason:'Duyệt lại 1 giờ'},admin.id,'ADMIN')
    const ot = await db.attendanceAdjustment.findFirst({where:{employee_id:emp.id,kind:'OVERTIME'}})
    await adjustments.reviewAdjustment(String(ot.id),{status:'APPROVED',note:'Duyệt lại',updated_at:ot.updated_at.toISOString()},{id:admin.id,role:'ADMIN'})
    await expect(payroll.finalizePeriod(period,admin.id,'ADMIN')).rejects.toThrow(/thay đổi/)
  })
  it('preserves finalized wages and blocks edits/generation on a closed row', async () => {
    await payroll.generate(period,emp.id,admin.id,{id:admin.id,role:'ADMIN'})
    await expect(payroll.finalizePeriod(period,admin.id,'ADMIN')).rejects.toThrow(/chưa kết thúc/)
    vi.setSystemTime(new Date('2026-11-01T08:00:00+07:00'))
    await payroll.finalizePeriod(period,admin.id,'ADMIN')
    const current = await db.payrollRecord.findFirst({where:{employeeId:emp.id}})
    await expect(payroll.updateItem(String(current.id),{hourly_rate:1},{id:admin.id,role:'ADMIN'})).rejects.toThrow()
    await expect(payroll.generate(period,emp.id,admin.id,{id:admin.id,role:'ADMIN'})).rejects.toThrow()
    expect((await db.payrollRecord.findUnique({where:{id:current.id}})).status).toBe('FINALIZED')
  })
  it('writes IN and OUT only after three distinct matching face recognitions', async () => {
    const employee = await db.employee.create({data:{employee_code:`FACE-${randomUUID().slice(0,8)}`,full_name:'Face Confirmation Test',hourly_rate:100000}})
    const embedding = Array(512).fill(1 / Math.sqrt(512))
    const vector = '[' + embedding.join(',') + ']'
    await db.$executeRaw`INSERT INTO face_embeddings (employee_id, embedding, model_version, embedding_type)
      VALUES (${employee.id}::uuid, ${vector}::vector, 'buffalo_s', 'CENTROID')`
    for (const [mode, time] of [['CHECK_IN','08:12:00'], ['CHECK_OUT','17:45:00']]) {
      const event = randomUUID()
      const payload = {device_id:'FACE_CONFIRM_PI',mode,event_id:event,client_timestamp:at(time),antispoof_score:.9,embedding}
      const before = await db.attendance_logs.count({where:{employee_id:employee.id}})
      const first = await service.handleThingsBoardWebhook({...payload,event_kind:'VERIFY_ONLY',recognition_id:event+'-1'})
      expect(first).toMatchObject({verification_only:true,confirmation_count:1})
      // Retrying the same physical recognition must not advance confirmation.
      expect(await service.handleThingsBoardWebhook({...payload,event_kind:'VERIFY_ONLY',recognition_id:event+'-1'})).toMatchObject({confirmation_count:1})
      const second = await service.handleThingsBoardWebhook({...payload,event_kind:'VERIFY_ONLY',recognition_id:event+'-2'})
      expect(second).toMatchObject({verification_only:true,confirmation_count:2})
      expect(await db.attendance_logs.count({where:{employee_id:employee.id}})).toBe(before)
      const commit = {...payload,event_kind:'CONFIRMED_SCAN',recognition_id:event+'-3',expected_employee_id:employee.id}
      expect(await service.handleThingsBoardWebhook(commit)).toMatchObject({success:true,matched:true})
      expect(await db.attendance_logs.count({where:{employee_id:employee.id}})).toBe(before+1)
      expect(await service.handleThingsBoardWebhook(commit)).toMatchObject({success:true,matched:true})
      expect(await db.attendance_logs.count({where:{employee_id:employee.id}})).toBe(before+1)
    }
  })

})
