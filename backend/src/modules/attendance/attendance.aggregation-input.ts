import { createHash } from 'node:crypto'
import { attendancePolicyVersion, shiftBounds, type PolicyLog, type PolicyPair, type PolicyShift } from './attendance.policy.js'

type AdjustmentInput = { kind: string; hours: unknown; amount: unknown; status: string; source_fingerprint: string; note?: string | null; reviewed_by?: string | null; reviewed_at?: Date | null }

export interface AggregationDayInput {
  date: string
  shift: (PolicyShift & { shift_id?: number | null }) | null
  logs: PolicyLog[]
  pairs: PolicyPair[]
  ignored: Array<{ id: string; date: string; reason: string }>
  pendingId?: string
  hourlyRate: number
  absenceRate: number | null
  adjustments: AdjustmentInput[]
  now: Date
}

export function aggregationInputFingerprint(input: AggregationDayInput) {
  const { start, end, off } = shiftBounds(input.date, input.shift)
  return createHash('sha256').update(JSON.stringify({
    version: 1, policy: attendancePolicyVersion(input.date),
    shift: [input.shift?.shift_id, Boolean(input.shift), start.toISOString(), end.toISOString(), off],
    ended: +input.now >= +end,
    logs: input.logs.map(log => [String(log.id), log.type, new Date(log.event_time).toISOString(), log.status || 'VALID', log.method, log.device_info, log.verification_score]),
    pairs: input.pairs, ignored: input.ignored, pending: input.pendingId,
    rate: input.hourlyRate, absenceRate: input.absenceRate,
    adjustments: [...input.adjustments].sort((a, b) => a.kind.localeCompare(b.kind)).map(row => [row.kind, Number(row.hours), Number(row.amount), row.status, row.source_fingerprint, row.note ?? null, row.reviewed_by ?? null, row.reviewed_at?.toISOString() ?? null]),
  })).digest('hex')
}
