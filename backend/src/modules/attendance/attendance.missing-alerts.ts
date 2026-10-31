import { shiftBounds, vnDay, attendanceWorkDate, type DatedPolicyShift } from './attendance.policy.js'
import { prisma } from '../../config/database.js'
import { isEmployeeManager } from '../employees/employee.permission.js'

export type MissingScanKind = 'CHECK_IN' | 'CHECK_OUT' | 'BOTH'

export function missingScanKind(shift: DatedPolicyShift, events: Array<{ type: string; status?: string | null }>, now: Date): MissingScanKind | null {
  const { end, off, isZeroDuration } = shiftBounds(vnDay(shift.work_date), shift)
  if (off || isZeroDuration || +now < +end + 30 * 60_000) return null
  const valid = events.filter(event => !event.status || event.status === 'VALID')
  const hasIn = valid.some(event => event.type === 'CHECK_IN')
  const hasOut = valid.some(event => event.type === 'CHECK_OUT' || event.type === 'TAN_CA')
  return hasIn && hasOut ? null : !hasIn && !hasOut ? 'BOTH' : hasIn ? 'CHECK_OUT' : 'CHECK_IN'
}

/** Advances only after notifications commit; a database advisory lock serializes multiple workers. */
export async function runMissingScanAlerts(now = new Date()) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('attendance-missing-scan-alerts'))`
    const checkpoint = await tx.attendanceAlertCheckpoint.findUniqueOrThrow({ where: { name: 'missing_shift_scans' } })
    const from = checkpoint.last_due_at
    if (+now <= +from) return { checked: 0, notified: 0 }
    // Limit each catch-up pass to seven days so long outages do not exceed transaction limits.
    const until = new Date(Math.min(+now, +from + 7 * 86400_000))
    const dateFrom = new Date(`${vnDay(new Date(+from - 3 * 86400_000))}T00:00:00Z`)
    const dateTo = new Date(`${vnDay(until)}T00:00:00Z`)
    const shifts = await tx.employee_shifts.findMany({
      where: { work_date: { gte: dateFrom, lte: dateTo }, employees: { status: 'ACTIVE' } },
      include: { work_shifts: true, employees: { include: { position: true, department: true, users: { include: { roles: true } } } } },
    })
    const schedule = shifts.map(s => ({ ...s, start_time: s.start_time ?? s.work_shifts.start_time, end_time: s.end_time ?? s.work_shifts.end_time }))
    const due = schedule.filter(s => {
      const bounds = shiftBounds(vnDay(s.work_date), s)
      const at = +bounds.end + 30 * 60_000
      return !bounds.off && !bounds.isZeroDuration && at > +from && at <= +until
    })
    if (!due.length) {
      await tx.attendanceAlertCheckpoint.update({ where: { name: checkpoint.name }, data: { last_due_at: until } })
      return { checked: 0, notified: 0 }
    }
    // Serialize with scan ingestion, which takes the same period locks before writing logs.
    for (const period of [...new Set(due.map(shift => vnDay(shift.work_date).slice(0, 7)))].sort()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${period}`}))`
    }
    const ids = [...new Set(due.map(s => s.employee_id))]
    const [logs, users] = await Promise.all([
      tx.attendance_logs.findMany({ where: { employee_id: { in: ids }, event_time: { gte: new Date(+dateFrom - 86400_000), lte: now } } }),
      tx.user.findMany({ where: { is_active: true, roles: { role_name: { in: ['ADMIN', 'MANAGER'] } } }, include: { roles: true, employees: true } }),
    ])
    const rows: Array<{ user_id: string; employee_id: string; event_key: string; title: string; message: string }> = []
    for (const shift of due) {
      const date = vnDay(shift.work_date)
      const ownSchedule = schedule.filter(s => s.employee_id === shift.employee_id)
      const bounds = shiftBounds(date, shift)
      const events = logs.filter(log => {
        if (log.employee_id !== shift.employee_id) return false
        const attributed = log.work_date ? vnDay(log.work_date) : attendanceWorkDate(log.event_time, ownSchedule)
        if (attributed === date) return true
        // A lone overnight checkout at or just after shift end can have the next calendar date.
        if (log.type !== 'CHECK_OUT' && log.type !== 'TAN_CA' || vnDay(bounds.end) === date || +log.event_time < +bounds.end - 3600_000 || +log.event_time > +bounds.end + 30 * 60_000) return false
        const nextShift = ownSchedule.find(s => vnDay(s.work_date) === attributed)
        if (nextShift) {
          const next = shiftBounds(attributed, nextShift)
          if (!next.off && !next.isZeroDuration && +log.event_time >= +next.start - 3600_000 && +log.event_time < +next.end) return false
        }
        return attributed === vnDay(bounds.end)
      })
      const missing = missingScanKind(shift, events, now)
      if (!missing) continue
      const label = missing === 'BOTH' ? 'check-in và check-out' : missing === 'CHECK_IN' ? 'check-in' : 'check-out'
      const title = 'Thiếu lượt chấm công sau ca'
      const message = `${shift.employees.full_name}, ngày ${date}, ca ${shift.work_shifts.shift_name} chưa có lượt ${label} hợp lệ. Vui lòng trao đổi với quản lý.`
      const recipients = new Set<string>()
      for (const user of users) {
        if (user.roles.role_name === 'ADMIN') recipients.add(user.id)
        else if (user.roles.role_name === 'MANAGER' && shift.employees.departmentId && !isEmployeeManager(shift.employees)
          && user.employees?.status === 'ACTIVE' && user.employees.departmentId === shift.employees.departmentId && user.id !== shift.employees.user_id) recipients.add(user.id)
      }
      if (shift.employees.user_id) recipients.add(shift.employees.user_id)
      for (const user_id of recipients) rows.push({ user_id, employee_id: shift.employee_id, event_key: `missing-shift:${shift.id}`, title, message })
    }
    const result = rows.length ? await tx.systemNotification.createMany({ data: rows, skipDuplicates: true }) : { count: 0 }
    await tx.attendanceAlertCheckpoint.update({ where: { name: checkpoint.name }, data: { last_due_at: until } })
    return { checked: due.length, notified: result.count }
  }, { timeout: 30000, maxWait: 10000 })
}
