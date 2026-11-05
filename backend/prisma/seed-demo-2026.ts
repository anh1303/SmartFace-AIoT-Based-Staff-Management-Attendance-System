/** Explicitly authorized demo reset: Sep/Oct/Nov 2026 only. Default is a dry run. */
import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/config/database.js'
import { calculateDay, prepareAttendance, shiftBounds, vnDay, roundHours } from '../src/modules/attendance/attendance.policy.js'
import { createAttendanceSnapshot } from '../src/modules/attendance/attendance.snapshot.js'
import { syncDayAdjustments, flushAdjustmentBatch } from '../src/modules/attendance/attendance.adjustments.js'
import { generate, finalizePeriod } from '../src/modules/payroll/payroll.service.js'
import { policyForPeriod } from '../src/common/payroll-policy.js'
import { sourceHourlyRate } from '../src/modules/employees/employee.wage.js'

const START = new Date('2026-09-01T00:00:00Z'), END = new Date('2026-12-01T00:00:00Z')
const range = { gte: START, lt: END }
const periods = ['2026-09', '2026-10', '2026-11']
const now = new Date()
const at = (day: string, time: string) => new Date(`${day}T${time.length === 5 ? time + ':00' : time}+07:00`)
const clock = (time: string) => new Date(`1970-01-01T${time}:00Z`)
type Case = { code: string; day: string; title: string; times: string[]; shift?: string; pending?: boolean; flagged?: boolean; manualOt?: number }
const cases: Case[] = []
function add(code: string, day: string, title: string, times: string[], extra: Partial<Case> = {}) {
  cases.push({ code, day: `2026-${day}`, title, times, ...extra })
}
add('NV-002','10-05','Đúng giờ', ['07:55','17:00'])
add('NV-003','10-05','Ân hạn đúng 15 phút', ['08:15','17:00'])
add('NV-005','10-05','Trễ 15 phút 1 giây, chưa đủ nửa giờ phạt', ['08:15:01','17:00'])
add('NV-006','10-05','Trễ 20 phút, phạt làm tròn 0', ['08:20','17:00'])
add('NV-002','10-06','Trễ 35 phút → 0,5 giờ phạt', ['08:35','17:00'])
add('NV-003','10-06','Về sớm 30 phút', ['08:00','16:30'])
add('NV-005','10-06','Trễ 40 phút và về sớm 40 phút', ['08:40','16:20'])
add('NV-006','10-06','Đến sớm không tự tính OT', ['07:00','17:00'])
add('NV-008','10-07','Ra ngoài 2 giờ, tổng 7 giờ thực tế, đủ ngưỡng', ['08:00','10:00','12:00','17:00'])
add('NV-009','10-07','Vào ra ba cặp', ['08:00','09:00','10:00','12:00','13:00','17:00'])
add('NV-011','10-08','OT đúng 30 phút không phát sinh khoản OT', ['08:00','17:30'])
add('NV-012','10-08','OT 30 phút 1 giây → 0,5 giờ', ['08:00','17:30:01'])
add('NV-014','10-08','OT 45 phút → 0,5 giờ', ['08:00','17:45'])
add('NV-015','10-08','OT 1,5 giờ', ['08:00','18:30'])
add('NV-017','10-09','OT 5 giờ chỉ duyệt tối đa 4 giờ', ['08:00','22:00'])
add('NV-018','10-09','Vắng mặt cả ca, phạt vắng theo hệ số 2', [])
add('NV-002','10-12','Quên check-out', ['08:00'])
add('NV-003','10-12','Quên check-in', ['17:00'])
add('NV-005','10-13','Hai IN liên tiếp: IN sau thay IN trước', ['08:00','09:00','17:00'])
add('NV-006','10-13','OUT dư không được tính OT', ['08:00','17:00','19:00'])
add('NV-008','10-14','Lượt bị đánh dấu làm gián đoạn cặp', ['08:00','12:00','17:00'], { flagged: true })
add('NV-009','10-14','Ca OFF không phạt vắng', [], { shift: 'OFF' })
add('NV-011','10-17','Làm ngày OFF 5 giờ, OT thủ công có thể vượt 4 giờ', ['09:00','14:00'], { shift: 'OFF', manualOt: 5 })
add('NV-012','10-19','Có quét nhưng chưa phân ca', ['09:00','12:00'], { shift: 'NO_SHIFT' })
add('NV-014','10-21','Ca sáng 4 giờ', ['08:00','12:00'], { shift: 'MORNING' })
add('NV-015','10-21','Ca chiều 4 giờ', ['13:00','17:00'], { shift: 'AFTERNOON' })
add('NV-014','10-28','Chính sách cũ: 5/9 giờ đủ nửa ca', ['08:00','13:00'])
add('NV-014','10-29','Chính sách mới: 5/9 giờ không đủ 2/3 ca', ['08:00','13:00'])
add('NV-017','10-29','Thiếu 1 giây so với 2/3 ca', ['08:00','13:59:59'])
add('NV-018','10-29','Đúng 6/9 giờ đủ 2/3 ca', ['08:00','14:00'])
add('NV-018','10-31','Ca đêm qua tháng: 22h → 06h hôm sau', ['22:00','+06:00'], { shift: 'OTHER' })
add('NV-002','10-26','CHỜ DUYỆT: miễn phạt trễ vì có lý do', ['08:40','17:00'], { pending: true })
add('NV-003','10-26','CHỜ DUYỆT: OT 1,5 giờ, có thể chỉ duyệt 1 giờ', ['08:00','18:30'], { pending: true })
add('NV-005','10-27','CHỜ DUYỆT: từ chối OT bằng cách đặt 0', ['08:00','18:30'], { pending: true })
add('NV-006','10-27','Đã duyệt phạt: mở khóa để sửa quyết định', ['08:35','17:00'])
add('NV-017','11-01','CHỜ DUYỆT: làm thêm ngày nghỉ 3 giờ', ['09:00','12:00'], { shift: 'OFF', pending: true })
add('NV-018','11-01','Ca đêm 22h → 06h ngày 2', ['22:00','+06:00'], { shift: 'OTHER' })
add('NV-018','11-02','Nghỉ sau ca đêm', [], { shift: 'OFF' })
add('NV-002','11-02','Dòng vào đầu ca: đúng giờ 08:15', ['08:15'])
add('NV-003','11-02','Dòng vào đầu ca: đi trễ 08:15:01', ['08:15:01'])
add('NV-019','11-02','Dòng vào đầu ca: đi trễ 08:30', ['08:30'])
add('NV-008','11-02','Ca sáng trễ 35 phút', ['08:35','12:00'], { shift: 'MORNING' })
add('NV-009','11-02','Ca sáng thiếu 1 giây so với 2/3 ca', ['08:00','10:39:59'], { shift: 'MORNING', pending: true })
add('NV-011','11-02','Ca sáng vắng mặt', [], { shift: 'MORNING', pending: true })
add('NV-012','11-02','Ca chưa kết thúc, chưa quét: chưa kết luận vắng', [])
add('NV-022','11-02','Nhân viên mới, chỉ có dữ liệu từ ngày tuyển', ['07:55','12:00'], { shift: 'MORNING' })

async function protectedFingerprint() {
  const result: Record<string, unknown> = {}
  for (const table of ['employees','users','departments','positions','face_embeddings','devices','bonus_penalty']) {
    result[table] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text),'')) hash FROM ${table} t`)
  }
  for (const table of ['attendance_logs','daily_attendance_summary','employee_shifts','attendance_adjustments','attendance_locks','payroll_records']) {
    const filter = table === 'payroll_records' ? "payroll_period NOT IN ('2026-09','2026-10','2026-11')" : table === 'attendance_logs' ? "coalesce(work_date,(event_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) < '2026-09-01' OR coalesce(work_date,(event_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) >= '2026-12-01'" : "work_date < '2026-09-01' OR work_date >= '2026-12-01'"
    result[table] = await prisma.$queryRawUnsafe(`SELECT count(*)::int n, md5(coalesce(string_agg(to_jsonb(t)::text, '' ORDER BY to_jsonb(t)::text),'')) hash FROM ${table} t WHERE ${filter}`)
  }
  return result
}
async function main() {
  if (vnDay(now) !== '2026-11-02') throw new Error('Demo frozen to 2026-11-02; review cutoff before using on another day')
  const target = new URL(process.env.DATABASE_URL!)
  if (!target.hostname.endsWith('.neon.tech') || target.pathname !== '/PBL6') throw new Error('Expected existing Neon PBL6')
  const employees = await prisma.employee.findMany({ orderBy: { employee_code: 'asc' } })
  const admin = await prisma.user.findFirstOrThrow({ where: { roles: { role_name: 'ADMIN' }, is_active: true } })
  const shifts = await prisma.work_shifts.findMany()
  const findShift = (kind: string) => {
    const hours: Record<string,string> = { OFFICE_HOURS: '08:00', MORNING: '08:00', AFTERNOON: '13:00', OFF: '00:00', OTHER: '22:00' }
    return shifts.find(s => kind === 'OFF' ? /nghỉ|off/i.test(s.shift_name) : kind === 'OTHER' ? /khác|other/i.test(s.shift_name) : s.start_time.toISOString().slice(11,16) === hours[kind] && (kind !== 'MORNING' || s.end_time.toISOString().slice(11,16) === '12:00')) || shifts.find(s => /khác|other/i.test(s.shift_name)) || shifts[0]
  }
  const assignments: Prisma.employee_shiftsCreateManyInput[] = []
  const raw: Prisma.attendance_logsCreateManyInput[] = []
  for (let day = new Date(START); day <= new Date('2026-11-02T00:00:00Z'); day.setUTCDate(day.getUTCDate()+1)) {
    const date = day.toISOString().slice(0,10)
    for (const emp of employees) {
      if (date < vnDay(emp.createdAt)) continue
      const demo = cases.find(c => c.code === emp.employee_code && c.day === date)
      const weekend = [0,6].includes(day.getUTCDay())
      const kind = demo?.shift || (weekend ? 'OFF' : 'OFFICE_HOURS')
      const start = kind === 'OTHER' ? '22:00' : kind === 'AFTERNOON' ? '13:00' : kind === 'OFF' ? '00:00' : '08:00'
      const end = kind === 'OTHER' ? '06:00' : kind === 'MORNING' ? '12:00' : kind === 'OFF' ? '00:00' : '17:00'
      if (kind !== 'NO_SHIFT') assignments.push({ employee_id: emp.id, work_date: new Date(day), shift_id: findShift(kind).id, shift_type: kind, start_time: clock(start), end_time: clock(end), work_day: ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'][day.getUTCDay()], note: demo?.title || 'Demo: lịch làm việc liên tục' })
      let times = demo?.times || (kind === 'OFF' ? [] : date === '2026-11-02' ? ['07:55'] : ['07:55','17:00'])
      if (!demo && !weekend && date < '2026-11-02') {
        const hash = [...`${date}:${emp.employee_code}`].reduce((n,c) => (n*31+c.charCodeAt(0))>>>0,0)%100
        if (hash < 4) times = []
        else if (hash < 11) times = ['08:35','17:00']
        else if (hash < 19) times = ['07:55','18:30']
        else if (hash < 23) times = ['08:00','16:30']
      }
      times.forEach((time,index) => {
        const next = time.startsWith('+')
        const eventDay = next ? new Date(+day+86400000).toISOString().slice(0,10) : date
        const event_time = at(eventDay,time.replace('+',''))
        if (+event_time > +now) return
        let type = index % 2 === 0 ? 'CHECK_IN' : 'CHECK_OUT'
        if (demo?.title.startsWith('Quên check-in')) type = 'CHECK_OUT'
        if (demo?.title.startsWith('Hai IN')) type = index < 2 ? 'CHECK_IN' : 'CHECK_OUT'
        if (demo?.title.startsWith('OUT dư')) type = index === 0 ? 'CHECK_IN' : 'CHECK_OUT'
        raw.push({ employee_id: emp.id, event_time, type, work_date: new Date(day), method: 'FACE', status: demo?.flagged && index === 1 ? 'FLAGGED' : 'VALID', device_info: 'device:GATE-01', verification_score: .96, liveness_score: .98, event_key: `demo20261102:${emp.employee_code}:${date}:${index}` })
      })
    }
  }
  console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'APPLY' : 'DRY_RUN', employees: employees.length, assignments: assignments.length, logs: raw.length, cases: cases.length, cutoff: now.toISOString(), periods }))
  if (!process.argv.includes('--apply')) return
  const before = await protectedFingerprint()
  const backup: Record<string, unknown> = {}
  for (const table of ['attendance_logs','daily_attendance_summary','employee_shifts','attendance_adjustments','attendance_locks','payroll_records']) {
    const where = table === 'payroll_records' ? "payroll_period IN ('2026-09','2026-10','2026-11')" : table === 'attendance_logs' ? "coalesce(work_date,(event_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) >= '2026-09-01' AND coalesce(work_date,(event_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) < '2026-12-01'" : "work_date >= '2026-09-01' AND work_date < '2026-12-01'"
    backup[table] = await prisma.$queryRawUnsafe(`SELECT to_jsonb(t) data FROM ${table} t WHERE ${where}`)
  }
  const backupPath = `/private/tmp/pbl6-attendance-before-demo-${Date.now()}.json`
  writeFileSync(backupPath, JSON.stringify(backup,(_,v) => typeof v === 'bigint' ? String(v) : v), { mode: 0o600 })
  console.log('Scoped backup:',backupPath)
  const policies = new Map(await Promise.all(periods.map(async p => [p, await policyForPeriod(p)] as const)))
  await prisma.$transaction(async tx => {
    for (const period of periods) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    await tx.attendanceAdjustment.deleteMany({ where: { work_date: range } })
    await tx.payrollRecord.deleteMany({ where: { payroll_period: { in: periods } } })
    await tx.$executeRaw`DELETE FROM attendance_logs WHERE coalesce(work_date,(event_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) >= ${START}::date AND coalesce(work_date,(event_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date) < ${END}::date`
    await tx.daily_attendance_summary.deleteMany({ where: { work_date: range } })
    await tx.employee_shifts.deleteMany({ where: { work_date: range } })
    await tx.attendance_locks.deleteMany({ where: { work_date: range } })
    await tx.attendanceAggregationState.deleteMany({ where: { period: { in: periods } } })
    // Remove only attendance notifications explicitly naming a reset month.
    await tx.systemNotification.deleteMany({ where: { AND: [ { OR: ['missing-shift:','aggregation-failed:','locked-scan:','auto-absent:'].map(prefix => ({ event_key: { startsWith: prefix } })) }, { OR: periods.map(period => ({ event_key: { contains: period } })) } ] } })
    for (let i=0;i<assignments.length;i+=250) await tx.employee_shifts.createMany({ data: assignments.slice(i,i+250) })
    for (let i=0;i<raw.length;i+=250) await tx.attendance_logs.createMany({ data: raw.slice(i,i+250) })
    const logs = await tx.attendance_logs.findMany({ where: { work_date: range }, orderBy: [{ event_time: 'asc' },{ id: 'asc' }] })
    const batch = { existing: new Map(), writes: [] as Prisma.AttendanceAdjustmentCreateManyInput[], audits: [] as Prisma.AuditLogCreateManyInput[] }
    const summaries: Prisma.daily_attendance_summaryCreateManyInput[] = []
    for (const emp of employees) {
      const empLogs = logs.filter(l => l.employee_id === emp.id)
      const empShifts = assignments.filter(s => s.employee_id === emp.id).map(s => ({...s, work_date: new Date(s.work_date), start_time: s.start_time as Date, end_time: s.end_time as Date }))
      const prepared = prepareAttendance(empLogs,empShifts)
      const dates = [...new Set([...empShifts.map(s => vnDay(s.work_date)),...empLogs.map(l => vnDay(l.work_date!))])].sort()
      for (const date of dates) {
        const shift = empShifts.find(s => vnDay(s.work_date) === date)
        const c = calculateDay(date,empLogs,shift||null,now,empShifts,prepared)
        const demo = cases.find(c => c.code === emp.employee_code && c.day === date)
        const { end, off } = shiftBounds(date,shift||null)
        const approved = !demo?.pending && (date < '2026-11-02' || !!shift && !off && +end <= +now)
        const pending = !!demo?.pending
        const data: Prisma.daily_attendance_summaryCreateManyInput = {
          employee_id: emp.id, work_date: new Date(`${date}T00:00:00Z`), shift_id: shift?.shift_id || null,
          first_check_in: c.first, last_check_out: c.last, total_working_hours: c.workingHours, late_early: c.lateEarlyHours,
          overtime: approved ? demo?.manualOt ?? c.overtimeCandidateHours : 0,
          regular_seconds: c.regularSeconds, overtime_seconds: c.overtimeSeconds, late_early_seconds: c.lateEarlySeconds,
          overtime_candidate_hours: demo?.manualOt ?? c.overtimeCandidateHours,
          overtime_status: (demo?.manualOt ?? c.overtimeCandidateHours) > 0 ? approved ? 'APPROVED' : 'PENDING' : 'NONE',
          attendance_status: c.status, review_status: approved ? 'APPROVED' : pending || c.requiresReview || c.overtimeCandidateHours > 0 || c.lateEarlyHours > 0 || c.absenceCandidate ? 'PENDING' : 'NONE',
          requires_review: approved ? false : c.requiresReview, review_reason: approved ? null : c.reviewReason,
          calculation_details: c.details, policy_version: c.details.policy,
          approved_by: approved ? admin.id : null, approved_at: approved ? now : null,
          approval_source: approved ? 'SEED_DEMO' : null, approval_reason: approved ? demo?.title || 'Dữ liệu demo đã đối chiếu' : null,
          reopened_at: pending ? now : null, reopened_by: pending ? admin.id : null,
          manual_adjustment: demo?.manualOt != null,
        }
        // Missing/invalid pairs on closed historical days: no absence charge; full-shift late/early fallback.
        if (approved && !off && shift && !c.details.absenceCandidate && c.details.pairs.length === 0 && c.details.events.length > 0) {
          data.total_working_hours = 0; data.overtime = 0; data.overtime_candidate_hours = 0; data.overtime_status = 'NONE'
          data.late_early = roundHours(c.details.scheduledShiftSeconds); data.late_early_seconds = c.details.scheduledShiftSeconds
        }
        if (approved) data.pre_approval_snapshot = createAttendanceSnapshot({ ...data, review_status: 'PENDING', requires_review: c.requiresReview, review_reason: c.reviewReason, overtime: 0, overtime_status: c.overtimeCandidateHours > 0 ? 'PENDING' : 'NONE', late_early: c.lateEarlyHours })
        summaries.push(data)
        await syncDayAdjustments(tx, data as any, sourceHourlyRate(emp,date.slice(0,7),null,false),policies.get(date.slice(0,7))?.absence_penalty_rate ?? null,batch)
      }
    }
    for (let i=0;i<summaries.length;i+=200) await tx.daily_attendance_summary.createMany({ data: summaries.slice(i,i+200) })
    await flushAdjustmentBatch(tx,batch)
    await tx.attendance_locks.createMany({ data: Array.from({length:30},(_,i) => ({ work_date: new Date(`2026-09-${String(i+1).padStart(2,'0')}T00:00:00Z`), is_locked: true, locked_by: admin.id })) })
    await tx.auditLog.create({ data: { userId: admin.id, action: 'SEED_ATTENDANCE_DEMO', target_table: 'daily_attendance_summary', record_id: '2026-09..11', new_values: { cutoff: now.toISOString(), assignments: assignments.length, logs: raw.length, summaries: summaries.length, cases: cases.length } } })
    console.log(JSON.stringify({ stage: 'reset-and-seed', summaries: summaries.length, adjustments: batch.writes.length }))
  }, { timeout: 60000, maxWait: 20000 })
  for (const period of periods) {
    const payroll = await generate(period,undefined,admin.id,{ id: admin.id, role: 'ADMIN' })
    console.log(JSON.stringify({ stage: 'payroll', period, records: payroll.length }))
    if (period === '2026-09') { await finalizePeriod(period,admin.id,'ADMIN'); console.log('September FINALIZED') }
  }
  const after = await protectedFingerprint()
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Protected records changed; inspect before completing')
  writeFileSync(new URL('../../docs/demo/seed-demo-2026-11-02-result.json', import.meta.url),JSON.stringify({ seededAt: now.toISOString(), protectedRecordsUnchanged: true, protectedFingerprints: after, cases },null,2))
  console.log('DONE: protected masters, biometrics and out-of-window attendance unchanged')
}
main().catch(e => { console.error('Seed failed:', e.code || e.name, e.message?.replace(/postgres(?:ql)?:\/\/\S+/g,'[REDACTED]')); process.exitCode=1 }).finally(() => prisma.$disconnect())
