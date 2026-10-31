import { annotatePairCredits } from './attendance.details.js'
import { createHash } from 'node:crypto'
/** Company policy v2026-10-19. Pure calculations; no database, network or rounding per pair. */
export const ATTENDANCE_POLICY_VERSION = '2026-10-29-v6'
export const TWO_THIRDS_EFFECTIVE_DATE = '2026-10-29'
export function attendancePolicyVersion(workDate: string): string {
  return workDate >= TWO_THIRDS_EFFECTIVE_DATE ? ATTENDANCE_POLICY_VERSION : '2026-10-26-v5'
}
export const MAX_PAIR_MS = 24 * 60 * 60 * 1000
export const OT_THRESHOLD_SECONDS = 30 * 60
export const OT_REVIEW_SECONDS = 4 * 60 * 60
/** Half-hour floor rule: 0-29m -> 0h; 30-59m -> 0.5h. */
export function roundHours(seconds: number): number {
  const duration = Math.max(0, seconds)
  const whole = Math.floor(duration / 3600)
  const remainder = duration - whole * 3600
  return whole + (remainder >= 1800 ? 0.5 : 0)
}
// Reuse ICU timezone data instead of constructing a formatter on every scan/day.
const vnDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
export const vnDay = (value: Date | string): string => {
  const date = new Date(value)
  return Number.isNaN(+date) ? 'Invalid Date' : vnDayFormatter.format(date)
}

export interface PolicyLog {
  id: string | bigint | number
  type: string
  event_time: Date | string
  status?: string
  method?: string
  device_info?: string | null
  verification_score?: number | null
}
export interface PolicyPair { inId: string; outId: string; start: Date; end: Date; workDate: string }

export function pairAttendance(logs: PolicyLog[], assignments: DatedPolicyShift[] = [], workDate = createWorkDateResolver(assignments)) {
  const ordered = logs.map((l, i) => ({ ...l, index: i }))
    .sort((a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime() ||
      (BigInt(a.id) < BigInt(b.id) ? -1 : BigInt(a.id) > BigInt(b.id) ? 1 : a.index - b.index))
  const pairs: PolicyPair[] = []
  const ignored: Array<{ id: string; date: string; reason: string }> = []
  let pending: (typeof ordered)[number] | undefined
  for (const log of ordered) {
    if (log.status && log.status !== 'VALID') {
      if (pending) ignored.push({ id: String(pending.id), date: workDate(pending.event_time), reason: 'INTERRUPTED_PAIR' })
      pending = undefined
      continue
    }
    if (log.type === 'CHECK_IN') {
      if (pending) ignored.push({ id: String(pending.id), date: workDate(pending.event_time), reason: 'REPLACED_CHECK_IN' })
      pending = log
    } else if (log.type === 'CHECK_OUT' || log.type === 'TAN_CA') {
      if (!pending) { ignored.push({ id: String(log.id), date: workDate(log.event_time), reason: 'UNPAIRED_CHECK_OUT' }); continue }
      const start = new Date(pending.event_time), end = new Date(log.event_time)
      const duration = end.getTime() - start.getTime()
      if (duration > 0 && duration <= MAX_PAIR_MS) {
        pairs.push({ inId: String(pending.id), outId: String(log.id), start, end, workDate: workDate(start) })
      } else {
        ignored.push({ id: String(pending.id), date: vnDay(start), reason: 'INVALID_PAIR' },
          { id: String(log.id), date: vnDay(end), reason: 'INVALID_PAIR' })
      }
      pending = undefined
    } else {
      if (pending) ignored.push({ id: String(pending.id), date: workDate(pending.event_time), reason: 'INTERRUPTED_PAIR' })
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

export type DatedPolicyShift = PolicyShift & { work_date: Date | string }
export function shiftBounds(workDate: string, shift: PolicyShift | null) {
  const start = new Date(`${workDate}T${clock(shift?.start_time, '08:00')}+07:00`)
  const end = new Date(`${workDate}T${clock(shift?.end_time, '17:00')}+07:00`)
  const off = shift?.shift_type === 'OFF'
  const isZeroDuration = +end === +start
  if (!off && !isZeroDuration && end < start) end.setUTCDate(end.getUTCDate() + 1)
  return { start, end, off, isZeroDuration }
}

/** Snapshot-scoped resolver: no identity data or mutable schedules cached globally. */
function createWorkDateResolver(assignments: DatedPolicyShift[]) {
  const windows = assignments.map(shift => {
    const date = vnDay(shift.work_date)
    return { date, ...shiftBounds(date, shift) }
  })
  const days = new Map<number, string>()
  return (time: Date | string) => {
    const at = +new Date(time)
    if (days.has(at)) return days.get(at)!
    const candidates = windows.filter(s => !s.off && !s.isZeroDuration && at >= +s.start - 3600000 && at < +s.end)
      .sort((a,b) => Number(+a.start > at) - Number(+b.start > at) || +b.start - +a.start)
    const date = candidates[0]?.date || vnDay(time)
    days.set(at, date)
    return date
  }
}

/** A re-entry after midnight still belongs to the assigned overnight shift. */
export function attendanceWorkDate(time: Date | string, assignments: DatedPolicyShift[]) {
  return createWorkDateResolver(assignments)(time)
}

/** Prepare once per employee/input snapshot, then reuse for every day in a month. */
export function prepareAttendance(logs: PolicyLog[], assignments: DatedPolicyShift[]) {
  const workDate = createWorkDateResolver(assignments)
  return { pairing: pairAttendance(logs, assignments, workDate), workDate }
}

export function calculateDay(workDate: string, logs: PolicyLog[], shift: PolicyShift | null, now = new Date(), assignments: DatedPolicyShift[] = [], prepared?: ReturnType<typeof prepareAttendance>) {
  const schedule = assignments.length ? assignments : shift ? [{ ...shift, work_date: workDate }] : []
  const context = prepared ?? prepareAttendance(logs, schedule)
  const result = context.pairing
  const pairs = result.pairs.filter(p => p.workDate === workDate)
  const ownedIds = new Set(pairs.flatMap(p => [p.inId, p.outId]))
  const foreignIds = new Set(result.pairs.filter(p => p.workDate !== workDate).flatMap(p => [p.inId, p.outId]))
  const source = logs.filter(l => ownedIds.has(String(l.id)) || context.workDate(l.event_time) === workDate && !foreignIds.has(String(l.id)))
  const sourceEvents = source.map(l => ({ id: String(l.id), type: l.type, time: new Date(l.event_time).toISOString(), status: l.status || 'VALID', method: l.method, device_info: l.device_info, verification_score: l.verification_score }))
  const ignored = result.ignored.filter(p => p.date === workDate)
  const open = result.pending && context.workDate(result.pending.event_time) === workDate
  const { start, end, off, isZeroDuration } = shiftBounds(workDate, shift)

  const scheduledShiftSeconds = shift && !off && !isZeroDuration ? Math.max(0, (+end - +start) / 1000) : 0
  let actualWorkedSecondsInShift = 0
  let rawOvertimeSeconds = 0
  if (shift && !off) {
    for (const p of pairs) {
      actualWorkedSecondsInShift += Math.max(0, (Math.min(+p.end, +end) - Math.max(+p.start, +start)) / 1000)
      rawOvertimeSeconds += Math.max(0, (+p.end - Math.max(+p.start, +end)) / 1000)
    }
  }

  // Overview entry is restricted to one hour before/in shift; exit is the last paired OUT.
  // Earlier scans remain in the evidence and actual duration calculations.
  const overviewPairs = pairs.filter(p => +p.start >= +start - 3600000 && +p.start <= +end)
  const first = overviewPairs[0]?.start ?? null
  const last = pairs.at(-1)?.end ?? null
  const actualFirst = pairs[0]?.start ?? null
  const actualLast = pairs.at(-1)?.end ?? null
  const twoThirds = workDate >= TWO_THIRDS_EFFECTIVE_DATE
  const requiredNumerator = twoThirds ? 2 : 1
  const requiredDenominator = twoThirds ? 3 : 2
  const meetsMinimumShift = Boolean(shift && !off && scheduledShiftSeconds > 0 && actualWorkedSecondsInShift * requiredDenominator >= scheduledShiftSeconds * requiredNumerator)
  const underMinimumShift = Boolean(shift && !off && pairs.length > 0 && !meetsMinimumShift)

  let regularSeconds = 0
  let overtimeSeconds = 0
  let lateSeconds = 0
  let earlySeconds = 0

  if (meetsMinimumShift) {
    // Lựa chọn B: Tổng giờ làm việc trong ngày = Giờ kết thúc ca - Giờ bắt đầu ca
    regularSeconds = scheduledShiftSeconds
    overtimeSeconds = rawOvertimeSeconds
    lateSeconds = actualFirst ? Math.min(scheduledShiftSeconds, Math.max(0, (+actualFirst - +start) / 1000)) : 0
    earlySeconds = actualLast ? Math.min(scheduledShiftSeconds, Math.max(0, (+end - +actualLast) / 1000)) : 0
  }
  // Below the dated eligibility threshold, retain evidence but grant no automatic wages or penalties.

  const lateEarlySeconds = lateSeconds + earlySeconds
  const invalid = ignored.some(l => l.reason === 'INVALID_PAIR' || l.reason === 'INTERRUPTED_PAIR')
  const flagged = source.some(l => l.status && l.status !== 'VALID')
  const orphanOut = !pairs.length && ignored.some(l => l.reason === 'UNPAIRED_CHECK_OUT')
  const noValidPair = sourceEvents.length > 0 && pairs.length === 0
  const review = Boolean(noValidPair || open || invalid || flagged || orphanOut || underMinimumShift || (!shift && (pairs.length || ignored.length)) || overtimeSeconds > OT_REVIEW_SECONDS)
  const absenceCandidate = Boolean(shift && !off && scheduledShiftSeconds > 0 && +now >= +end && sourceEvents.length === 0 && !open && !ignored.length)
  let status = off ? 'OFF' : !shift ? 'NO_SHIFT' : !pairs.length && !open && +now < +end ? 'SCHEDULED' : absenceCandidate ? 'ABSENT' : 'PRESENT'
  if (!off && shift && (open || invalid || orphanOut || underMinimumShift)) status = 'INCOMPLETE'
  else if (!off && shift && first && meetsMinimumShift) {
    if (lateSeconds > 900 && earlySeconds > 0) status = 'LATE_AND_EARLY'
    else if (lateSeconds > 900) status = 'LATE'
    else if (earlySeconds > 0) status = 'EARLY_LEAVE'
  }
  const candidate = overtimeSeconds > OT_THRESHOLD_SECONDS ? roundHours(overtimeSeconds) : 0
  return {
    first, last, regularSeconds, overtimeSeconds, lateEarlySeconds, absenceCandidate,
    workingHours: roundHours(regularSeconds), lateEarlyHours: roundHours(lateEarlySeconds),
    overtimeCandidateHours: candidate, status, requiresReview: review,
    reviewReason: [
      open ? 'MISSING_CHECK_OUT' : '',
      noValidPair ? 'NO_VALID_PAIR' : '',
      invalid ? 'INVALID_PAIR' : '',
      flagged ? 'FLAGGED_EVENT' : '',
      orphanOut ? 'UNPAIRED_CHECK_OUT' : '',
      underMinimumShift ? twoThirds ? 'UNDER_MINIMUM_SHIFT' : 'UNDER_HALF_SHIFT' : '',
      !shift && (pairs.length || ignored.length) ? 'NO_SHIFT' : '',
      overtimeSeconds > OT_REVIEW_SECONDS ? 'OT_OVER_4H' : '',
    ].filter(Boolean).join(',') || null,
    details: {
      events: sourceEvents,
      fingerprint: createHash('sha256').update(JSON.stringify({
        logs: source.map(l => [String(l.id), l.type, new Date(l.event_time).toISOString(), l.status]),
        start: start.toISOString(), end: end.toISOString(), off: Boolean(off), assigned: Boolean(shift),
      })).digest('hex'),
      policy: attendancePolicyVersion(workDate),
      pairs: annotatePairCredits(pairs.map(p => ({ ...p, start: p.start.toISOString(), end: p.end.toISOString() })), {
        start: start.toISOString(), end: end.toISOString(), scheduledSeconds: scheduledShiftSeconds,
        workingHours: roundHours(regularSeconds), candidateHours: candidate, off: Boolean(off), requiredNumerator, requiredDenominator,
      }),
      details_version: 3,
      ignored,
      off: Boolean(off),
      scheduledStart: start.toISOString(),
      scheduledEnd: end.toISOString(),
      actualWorkedSecondsInShift,
      scheduledShiftSeconds,
      meetsMinimumShift,
      minimumShiftNumerator: requiredNumerator,
      minimumShiftDenominator: requiredDenominator,
      // Legacy consumers can still read old half-shift evidence.
      ...(!twoThirds ? { meetsHalfShift: meetsMinimumShift } : {}),
      absenceCandidate,
      overviewPairIds: overviewPairs.map(p => [p.inId, p.outId]),
      // Internal gaps are evidence only; they do not add late/early penalties.
      internalGapSeconds: Math.max(0, actualFirst && actualLast ? (+actualLast - +actualFirst) / 1000 - pairs.reduce((n, p) => n + (+p.end - +p.start) / 1000, 0) : 0),
    },
  }
}
