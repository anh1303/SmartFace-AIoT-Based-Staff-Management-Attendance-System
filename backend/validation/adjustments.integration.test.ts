import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest'
const enabled = process.env.RUN_POLICY_DB_TESTS === '1'
if (enabled && ![process.env.DATABASE_URL,process.env.DIRECT_URL].every(url => url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55439\/policy_check$/.test(url))) throw new Error('Isolated policy_check URLs required')
const suite = enabled ? describe : describe.skip
suite('Daily OT and penalty ledger on isolated PostgreSQL', () => {
  let db: any, attendance: any, payroll: any, adjustments: any, admin: any, ws: any
  const actor = () => ({id:admin.id,role:'ADMIN'})
  const rows = (emp: any) => db.attendanceAdjustment.findMany({where:{employee_id:emp.id},orderBy:{work_date:'asc'}})
  async function fixture(date: string, night = false) {
    const emp = await db.employee.create({data:{employee_code:`LEDGER-${randomUUID().slice(0,8)}`,full_name:'Ledger Test',hourly_rate:100000}})
    await db.employee_shifts.create({data:{employee_id:emp.id,shift_id:ws.id,work_date:new Date(`${date}T00:00:00Z`),shift_type:night?'NIGHT':'OFFICE_HOURS',start_time:new Date(`1970-01-01T${night?'22:00':'08:00'}:00Z`),end_time:new Date(`1970-01-01T${night?'06:00':'16:00'}:00Z`)}})
    return emp
  }
  const aggregate = (emp: any, date: string) => attendance.aggregateDailyAttendance(+date.slice(5,7),+date.slice(0,4),emp.id)
  const raw = (emp: any,type: string,date: string,time: string) => db.attendance_logs.create({data:{employee_id:emp.id,type,event_time:new Date(`${date}T${time}+07:00`),status:'VALID',method:'MANUAL'}})
  const review = (item: any,status: string,note = '') => adjustments.reviewAdjustment(String(item.id),{status,note,updated_at:item.updated_at.toISOString()},actor())
  beforeAll(async () => {
    vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T20:00:00+07:00'))
    db = (await import('../src/config/database.js')).prisma
    attendance = await import('../src/modules/attendance/attendance.service.js')
    payroll = await import('../src/modules/payroll/payroll.service.js')
    adjustments = await import('../src/modules/payroll/payroll.adjustments.js')
    const role = await db.roles.upsert({where:{role_name:'ADMIN'},create:{role_name:'ADMIN'},update:{}})
    admin = await db.user.create({data:{username:`ledger-${randomUUID().slice(0,8)}`,passwordHash:'test-only',role_id:role.id}})
    ws = await db.work_shifts.create({data:{shift_name:'Ledger Test',start_time:new Date('1970-01-01T08:00:00Z'),end_time:new Date('1970-01-01T16:00:00Z')}})
    await payroll.updateBonusPenalty({overtime_rate:100000,late_early_penalty:50000,absence_penalty_rate:0.25},admin.id)
  })
  afterAll(async () => {vi.useRealTimers();if(db) await db.$disconnect()})
  it('proposes 25% shift wages, stores leave notes and only deducts approved absence', async () => {
    const date='2025-01-03', emp=await fixture(date)
    await aggregate(emp,date)
    let [item]=await rows(emp)
    expect(item.kind).toBe('ABSENCE');expect(item.status).toBe('PENDING');expect(Number(item.amount)).toBe(200000)
    let [pay]=await payroll.generate('2025-01',emp.id,admin.id,actor())
    expect(pay.total_absence_penalty).toBe(0)
    await expect(payroll.finalizePeriod('2025-01',admin.id,'ADMIN')).rejects.toThrow(/chờ duyệt/)
    await review(item,'REJECTED','Nghỉ có phép')
    await aggregate(emp,date)
    ;[item]=await rows(emp);expect(item.status).toBe('REJECTED');expect(item.note).toBe('Nghỉ có phép')
    await review(item,'APPROVED','Xác minh lại: nghỉ không phép')
    await expect(payroll.finalizePeriod('2025-01',admin.id,'ADMIN')).rejects.toThrow(/thay đổi/)
    ;[pay]=await payroll.generate('2025-01',emp.id,admin.id,actor());expect(pay.total_absence_penalty).toBe(200000);expect(pay.net_salary).toBe(1300000)
    await payroll.finalizePeriod('2025-01',admin.id,'ADMIN')
    ;[item]=await rows(emp);await expect(review(item,'REJECTED','Đã chốt')).rejects.toThrow(/chốt|khóa/)
  })
  it('reviews OT and late penalties independently by day, with stale-write protection', async () => {
    const date='2025-02-03',emp=await fixture(date)
    await raw(emp,'CHECK_IN',date,'09:00:00');await raw(emp,'CHECK_OUT',date,'17:00:00')
    await aggregate(emp,date)
    const items=await rows(emp),ot=items.find((r:any)=>r.kind==='OVERTIME'),late=items.find((r:any)=>r.kind==='LATE_EARLY')
    expect(items).toHaveLength(2)
    await review(ot,'APPROVED','Làm thêm đã xác nhận')
    let [pay]=await payroll.generate('2025-02',emp.id,admin.id,actor())
    expect(pay.total_overtime).toBe(1);expect(pay.total_late_early).toBe(0)
    await review(late,'REJECTED','Được phép vào muộn')
    await expect(review(late,'APPROVED')).rejects.toThrow(/thay đổi/)
    ;[pay]=await payroll.generate('2025-02',emp.id,admin.id,actor());expect(pay.net_salary).toBe(2400000)
    await payroll.updateItem(pay.id,{allowance:0,reason:'Điều chỉnh phụ cấp'},actor())
    const freshLate=(await rows(emp)).find((r:any)=>r.kind==='LATE_EARLY')
    await review(freshLate,'APPROVED','Đã xác minh')
    ;[pay]=await payroll.generate('2025-02',emp.id,admin.id,actor());expect(pay.allowance).toBe(0);expect(pay.total_late_early).toBe(1);expect(pay.net_salary).toBe(850000)
    await expect(payroll.updateItem(pay.id,{total_overtime:20,reason:'Ghi đè'},actor())).rejects.toThrow(/từng khoản/)
  })
  it('invalidates reviewed absence when scans arrive, retaining the old decision in audit', async () => {
    const date='2025-03-03',emp=await fixture(date)
    await aggregate(emp,date);const [absent]=await rows(emp);await review(absent,'APPROVED','Vắng')
    await raw(emp,'CHECK_IN',date,'08:00:00');await raw(emp,'CHECK_OUT',date,'16:00:00');await aggregate(emp,date)
    const [changed]=await rows(emp);expect(changed.status).toBe('VOID');expect(changed.note).toBe('Vắng')
    expect(await db.auditLog.count({where:{record_id:String(changed.id),action:'INVALIDATE_ADJUSTMENT_REVIEW'}})).toBeGreaterThan(0)
  })
  it('joins split overnight attendance across month end and keeps OT on the shift date', async () => {
    const date='2025-04-30',emp=await fixture(date,true)
    await raw(emp,'CHECK_IN',date,'22:00:00');await raw(emp,'CHECK_OUT','2025-05-01','01:00:00')
    await raw(emp,'CHECK_IN','2025-05-01','01:30:00');await raw(emp,'CHECK_OUT','2025-05-01','07:00:00')
    await aggregate(emp,date);await aggregate(emp,'2025-05-01')
    const days=await db.daily_attendance_summary.findMany({where:{employee_id:emp.id}})
    expect(days.filter((r:any)=>Number(r.total_working_hours)>0)).toHaveLength(1)
    const previous=days.find((r:any)=>r.work_date.toISOString().startsWith(date))
    expect(Number(previous.total_working_hours)).toBe(8);expect(previous.calculation_details.pairs).toHaveLength(2)
    const [ot]=await rows(emp);expect(ot.kind).toBe('OVERTIME');expect(ot.status).toBe('PENDING');expect(ot.work_date.toISOString().startsWith(date)).toBe(true)
    await review(ot,'APPROVED','OT ca đêm')
    const [pay]=await payroll.generate('2025-04',emp.id,admin.id,actor());expect(pay.total_overtime).toBe(1)
  })
  it('assigns live midnight re-entry to yesterday and recomputes the previous month immediately', async () => {
    const date='2025-06-30',emp=await fixture(date,true)
    vi.setSystemTime(new Date('2025-07-01T08:00:00+07:00'))
    try {
      for (const [type,at] of [['CHECK_IN',`${date}T22:00:00+07:00`],['CHECK_OUT','2025-07-01T01:00:00+07:00'],['CHECK_IN','2025-07-01T01:30:00+07:00'],['CHECK_OUT','2025-07-01T07:00:00+07:00']]) {
        const capture={eventId:randomUUID(),capturedAt:+new Date(at)}
        if (type==='CHECK_IN') await attendance.checkIn({employeeId:emp.id},undefined,capture)
        else {
          const response=await attendance.checkOut(emp.id,undefined,undefined,capture)
          const immediate=await db.daily_attendance_summary.findUnique({where:{employee_id_work_date:{employee_id:emp.id,work_date:new Date(`${date}T00:00:00Z`)}}})
          const firstCheckout=at.includes('01:00:00')
          expect(immediate.calculation_details.pairs).toHaveLength(firstCheckout?1:2)
          expect(Number(immediate.total_working_hours)).toBe(firstCheckout?0:8)
          expect(immediate.calculation_details.pairs.reduce((n:any,p:any)=>n+p.credited_regular_seconds,0)).toBe(firstCheckout?0:28800)
          expect(response.summaries.some((s:any)=>s.date===date&&s.total_working_hours===(firstCheckout?0:8))).toBe(true)
        }
      }
      const logs=await db.attendance_logs.findMany({where:{employee_id:emp.id}})
      expect(logs.every((l:any)=>l.work_date.toISOString().startsWith(date))).toBe(true)
      const day=await db.daily_attendance_summary.findUnique({where:{employee_id_work_date:{employee_id:emp.id,work_date:new Date(`${date}T00:00:00Z`)}}})
      expect(day.calculation_details.pairs).toHaveLength(2);expect(Number(day.total_working_hours)).toBe(8);expect(day.overtime_status).toBe('PENDING')
    } finally {vi.setSystemTime(new Date('2026-10-20T20:00:00+07:00'))}
  })

  it('uses the production SQL batch and refuses to lock an unfinished overnight shift', async () => {
    const date='2025-07-30',emp=await fixture(date,true)
    const original=process.env.NODE_ENV
    vi.setSystemTime(new Date('2025-07-31T00:30:00+07:00'))
    try {
      process.env.NODE_ENV='production'
      await aggregate(emp,date)
      expect(await rows(emp)).toHaveLength(0)
      await expect(attendance.toggleLock(date,true,admin.id,'ADMIN')).rejects.toThrow(/chưa kết thúc/)
      vi.setSystemTime(new Date('2025-07-31T08:00:00+07:00'))
      await aggregate(emp,date)
      const [absence]=await rows(emp);expect(absence.status).toBe('PENDING');expect(Number(absence.amount)).toBe(200000)
    } finally {process.env.NODE_ENV=original;vi.setSystemTime(new Date('2026-10-20T20:00:00+07:00'))}
  })
  it('limits managers to their department and blocks self/peer approval', async () => {
    const suffix=randomUUID().slice(0,8)
    const dept=await db.department.create({data:{department_code:`LEDGER-A-${suffix}`,name:'A'}})
    const otherDept=await db.department.create({data:{department_code:`LEDGER-B-${suffix}`,name:'B'}})
    const role=await db.roles.upsert({where:{role_name:'MANAGER'},create:{role_name:'MANAGER'},update:{}})
    const user=await db.user.create({data:{username:`ledger-manager-${suffix}`,passwordHash:'test-only',role_id:role.id}})
    const peerUser=await db.user.create({data:{username:`ledger-peer-${suffix}`,passwordHash:'test-only',role_id:role.id}})
    const self=await fixture('2025-08-03'),target=await fixture('2025-08-04'),other=await fixture('2025-08-05'),peer=await fixture('2025-08-06')
    await db.employee.update({where:{id:self.id},data:{departmentId:dept.id,user_id:user.id}})
    await db.employee.update({where:{id:target.id},data:{departmentId:dept.id}})
    await db.employee.update({where:{id:other.id},data:{departmentId:otherDept.id}})
    await db.employee.update({where:{id:peer.id},data:{departmentId:dept.id,user_id:peerUser.id}})
    for (const emp of [self,target,other,peer]) await aggregate(emp,'2025-08-03')
    const manager={id:user.id,role:'MANAGER'}
    const listed=await adjustments.listAdjustments('2025-08',undefined,manager)
    expect(listed.map((r:any)=>r.employee_id).sort()).toEqual([self.employee_code,target.employee_code].sort())
    for (const emp of [self,other,peer]) {
      const [item]=await rows(emp)
      await expect(adjustments.reviewAdjustment(String(item.id),{status:'APPROVED',updated_at:item.updated_at.toISOString()},manager)).rejects.toThrow()
    }
    const [item]=await rows(target)
    await adjustments.reviewAdjustment(String(item.id),{status:'REJECTED',note:'Có phép',updated_at:item.updated_at.toISOString()},manager)
    expect((await rows(target))[0].status).toBe('REJECTED')
  })

  it('batch-updates an already reviewed item when its source shift changes', async () => {
    const date='2025-09-03',emp=await fixture(date)
    await raw(emp,'CHECK_IN',date,'08:00:00');await raw(emp,'CHECK_OUT',date,'17:00:00');await aggregate(emp,date)
    const [ot]=await rows(emp);await review(ot,'APPROVED','Đã xác nhận')
    await db.employee_shifts.update({where:{employee_id_work_date:{employee_id:emp.id,work_date:new Date(`${date}T00:00:00Z`)}},data:{end_time:new Date('1970-01-01T15:00:00Z')}})
    await aggregate(emp,date)
    const [updated]=await rows(emp);expect(updated.status).toBe('PENDING');expect(Number(updated.hours)).toBe(2);expect(updated.note).toBe('Đã xác nhận')
    expect(await db.auditLog.count({where:{record_id:String(ot.id),action:'INVALIDATE_ADJUSTMENT_REVIEW'}})).toBeGreaterThan(0)
  })

  it('reads per-checkout credits from legacy daily summaries without rewriting their data', async () => {
    const date='2025-10-03',emp=await fixture(date)
    await db.employee_shifts.update({where:{employee_id_work_date:{employee_id:emp.id,work_date:new Date(`${date}T00:00:00Z`)}},data:{end_time:new Date('1970-01-01T18:00:00Z')}})
    await raw(emp,'CHECK_IN',date,'07:52:43');await raw(emp,'CHECK_OUT',date,'17:47:36');await aggregate(emp,date)
    const summary=await db.daily_attendance_summary.findFirst({where:{employee_id:emp.id}})
    const oldDetails={...summary.calculation_details,policy:'2026-10-25-v4',pairs:summary.calculation_details.pairs.map((p:any)=>({inId:p.inId,outId:p.outId,start:p.start,end:p.end,workDate:p.workDate}))}
    delete oldDetails.details_version
    await db.daily_attendance_summary.update({where:{id:summary.id},data:{calculation_details:oldDetails,policy_version:'2026-10-25-v4'}})
    const [response]=await attendance.getDailySummaries({employeeId:emp.id,date},actor())
    expect(response.total_working_hours).toBe(10)
    expect(response.calculation_details.pairs[0]).toMatchObject({counted:true,regular_seconds:35256,credited_regular_seconds:36000})
    const unchanged=await db.daily_attendance_summary.findUnique({where:{id:summary.id}})
    expect(unchanged.policy_version).toBe('2026-10-25-v4');expect(unchanged.calculation_details.pairs[0]).not.toHaveProperty('credited_regular_seconds')
  })

})
