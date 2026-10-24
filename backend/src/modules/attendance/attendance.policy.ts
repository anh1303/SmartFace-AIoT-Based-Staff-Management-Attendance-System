import { createHash } from 'node:crypto'
/** Company policy v2026-10-19. Pure calculations; no database, network or rounding per pair. */
export const ATTENDANCE_POLICY_VERSION = '2026-10-19-v2'
export const MAX_PAIR_MS = 24 * 60 * 60 * 1000
export const OT_THRESHOLD_SECONDS = 30 * 60
export const OT_REVIEW_SECONDS = 4 * 60 * 60
/** Fractional hour bands: <0.5 -> 0; [0.5,0.75) -> 0.5; >=0.75 -> 1. */
export function roundHours(seconds: number): number {
  const duration = Math.max(0, seconds)
  const whole = Math.floor(duration / 3600)
  const remainder = duration - whole * 3600
  return whole + (remainder >= 2700 ? 1 : remainder >= 1800 ? 0.5 : 0)
}
export const vnDay = (value: Date | string): string => new Date(value).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

export interface PolicyLog {
  id: string | bigint | number
  type: string
  event_time: Date | string
  status?: string
}
export interface PolicyPair { inId: string; outId: string; start: Date; end: Date; workDate: string }

export function pairAttendance(logs: PolicyLog[]) {
  const ordered = logs.map((l, i) => ({ ...l, index: i }))
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime() ||
      (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : a.index - b.index))
  const pairs: PolicyPair[] = []
  const ignored: Array<{ id: string; date: string; reason: string }> = []
  let pending: (typeof ordered)[number] | undefined
  for (const log of ordered) {
    if (log.status && log.status !== 'VALID') {
      if (pending) ignored.push({ id: String(pending.id), date: vnDay(pending.event_time), reason: 'INTERRUPTED_PAIR' })
      pending = undefined
      continue
    }
    if (log.type === 'CHECK_IN') {
      if (pending) ignored.push({ id: String(pending.id), date: vnDay(pending.event_time), reason: 'REPLACED_CHECK_IN' })
      pending = log
    } else if (log.type === 'CHECK_OUT' || log.type === 'TAN_CA') {
      if (!pending) { ignored.push({ id: String(log.id), date: vnDay(log.event_time), reason: 'UNPAIRED_CHECK_OUT' }); continue }
      const start = new Date(pending.event_time), end = new Date(log.event_time)
      const duration = end.getTime() - start.getTime()
      if (duration > 0 && duration <= MAX_PAIR_MS) {
        pairs.push({ inId: String(pending.id), outId: String(log.id), start, end, workDate: vnDay(start) })
      } else {
        ignored.push({ id: String(pending.id), date: vnDay(start), reason: 'INVALID_PAIR' },
          { id: String(log.id), date: vnDay(end), reason: 'INVALID_PAIR' })
      }
      pending = undefined
    } else {
      if (pending) ignored.push({ id: String(pending.id), date: vnDay(pending.event_time), reason: 'INTERRUPTED_PAIR' })
      pending = undefined
    }
  }
  return { pairs, ignored, pending }
}

export interface PolicyShift { start_time?: string | Date | null; end_time?: string | Date | null; shift_type?: string | null }
function clock(time: string | Date | null | undefined, fallback: string) {
  if (time instanceof Date) return time.toISOString().slice(11, 19)
  if (time?.includes('T')) return new Date(time).toISOString().slice(11, 19)
  return (time || fallback).slice(0, 5) + ':00'
}

export function calculateDay(workDate: string, logs: PolicyLog[], shift: PolicyShift | null, now = new Date()) {
  const result = pairAttendance(logs)
  const pairs = result.pairs.filter(p => p.workDate === workDate)
  const ownedIds = new Set(pairs.flatMap(p => [p.inId, p.outId]))
  const foreignIds = new Set(result.pairs.filter(p => p.workDate !== workDate).flatMap(p => [p.inId, p.outId]))
  const source = logs.filter(l => ownedIds.has(String(l.id)) || vnDay(l.event_time) === workDate && !foreignIds.has(String(l.id)))
  const sourceEvents = source.map(l => ({ id: String(l.id), type: l.type, time: new Date(l.event_time).toISOString(), status: l.status || 'VALID' }))
  const ignored = result.ignored.filter(p => p.date === workDate)
  const open = result.pending && vnDay(result.pending.event_time) === workDate
  const off = shift?.shift_type === 'OFF'
  const start = new Date(`${workDate}T${clock(shift?.start_time, '08:00')}+07:00`)
  const end = new Date(`${workDate}T${clock(shift?.end_time, '17:30')}+07:00`)
  if (!off && end <= start) end.setUTCDate(end.getUTCDate() + 1)
  let regularSeconds = 0, overtimeSeconds = 0
  if (shift && !off) for (const p of pairs) {
    regularSeconds += Math.max(0, (Math.min(+p.end, +end) - Math.max(+p.start, +start)) / 1000)
    overtimeSeconds += Math.max(0, (+p.end - Math.max(+p.start, +end)) / 1000)
  }
  const first = pairs[0]?.start ?? (open ? new Date(result.pending!.event_time) : null)
  const last = pairs.at(-1)?.end ?? null
  const lateSeconds = shift && !off && pairs.length && first ? Math.min((+end - +start) / 1000, Math.max(0, (+first - +start) / 1000)) : 0
  const earlySeconds = shift && !off && last ? Math.min((+end - +start) / 1000, Math.max(0, (+end - +last) / 1000)) : 0
  const invalid = ignored.some(l => l.reason === 'INVALID_PAIR' || l.reason === 'INTERRUPTED_PAIR')
  const flagged = logs.some(l => l.status === 'FLAGGED' && vnDay(l.event_time) === workDate)
  const orphanOut = !pairs.length && ignored.some(l => l.reason === 'UNPAIRED_CHECK_OUT')
  const review = Boolean(open || invalid || flagged || orphanOut || (!shift && (pairs.length || ignored.length)) || overtimeSeconds > OT_REVIEW_SECONDS)
  let status = off ? 'OFF' : !shift ? 'NO_SHIFT' : +start > +now ? 'SCHEDULED' : !first && !last ? 'ABSENT' : 'PRESENT'
  if (!off && shift && (open || invalid)) status = 'INCOMPLETE'
  else if (!off && shift && first) {
    if (lateSeconds > 900 && earlySeconds > 0) status = 'LATE_AND_EARLY'
    else if (lateSeconds > 900) status = 'LATE'
    else if (earlySeconds > 0) status = 'EARLY_LEAVE'
  }
  const candidate = overtimeSeconds > OT_THRESHOLD_SECONDS ? roundHours(overtimeSeconds) : 0
  return {
    first, last, regularSeconds, overtimeSeconds, lateEarlySeconds: lateSeconds + earlySeconds,
    workingHours: roundHours(regularSeconds), lateEarlyHours: roundHours(lateSeconds + earlySeconds),
    overtimeCandidateHours: candidate, status, requiresReview: review,
    reviewReason: [open ? 'MISSING_CHECK_OUT' : '', invalid ? 'INVALID_PAIR' : '', flagged ? 'FLAGGED_EVENT' : '', orphanOut ? 'UNPAIRED_CHECK_OUT' : '',
      !shift && (pairs.length || ignored.length) ? 'NO_SHIFT' : '', overtimeSeconds > OT_REVIEW_SECONDS ? 'OT_OVER_4H' : ''].filter(Boolean).join(',') || null,
    details: { events: sourceEvents,
      fingerprint: createHash('sha256').update(JSON.stringify({
        logs: source.map(l => [String(l.id), l.type, new Date(l.event_time).toISOString(), l.status]),
        start: start.toISOString(), end: end.toISOString(), off: Boolean(off), assigned: Boolean(shift),
      })).digest('hex'), policy: ATTENDANCE_POLICY_VERSION, pairs: pairs.map(p => ({ ...p, start: p.start.toISOString(), end: p.end.toISOString() })), ignored,
      off: Boolean(off), scheduledStart: start.toISOString(), scheduledEnd: end.toISOString() },
  }
}
