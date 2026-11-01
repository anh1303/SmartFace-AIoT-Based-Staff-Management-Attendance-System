import { createHash } from 'node:crypto'
import { Prisma, type AttendanceAdjustment } from '@prisma/client'
import { AppError } from '../../common/AppError.js'

export interface AdjustmentSource {
  employee_id: string
  work_date: Date
  overtime_candidate_hours: unknown
  overtime: unknown
  overtime_status: string
  review_status?: string | null
  late_early: unknown
  manual_adjustment?: boolean | null
  overtime_reason?: string | null
  approval_reason?: string | null
  approved_by?: string | null
  approved_at?: Date | null
  calculation_details: unknown
}

export interface AdjustmentBatch {
  existing: Map<string, AttendanceAdjustment>
  writes: Prisma.AttendanceAdjustmentCreateManyInput[]
  audits: Prisma.AuditLogCreateManyInput[]
}

/** Called in the same transaction as day aggregation; closed dates are never passed. */
export async function syncDayAdjustments(tx: Prisma.TransactionClient, day: AdjustmentSource, hourlyRate: number, absenceRate: number | null, batch?: AdjustmentBatch) {
  const details = (day.calculation_details || {}) as Record<string, unknown>
  const absence = details.absenceCandidate === true
  const hours = Number(details.scheduledShiftSeconds || 0) / 3600
  const isDayApproved = day.review_status === 'APPROVED'
  const items = [
    { kind: 'OVERTIME', hours: Number(isDayApproved ? day.overtime : day.overtime_candidate_hours), amount: 0 },
    { kind: 'LATE_EARLY', hours: Number(day.late_early), amount: 0 },
    { kind: 'ABSENCE', hours: absence ? hours : 0, amount: 0 },
  ]
  for (const item of items) {
    const key = { employee_id: day.employee_id, work_date: day.work_date, kind: item.kind }
    const previous = batch ? batch.existing.get(`${key.employee_id}:${key.work_date.toISOString().slice(0,10)}:${key.kind}`) : await tx.attendanceAdjustment.findUnique({ where: { employee_id_work_date_kind: key } })
    const previousDetails = previous?.source_details as Record<string, unknown> | null
    const savedRate = previousDetails?.absence_penalty_rate
    const effectiveRate = savedRate != null ? Number(savedRate) : absenceRate
    if (item.kind === 'ABSENCE' && absence) {
      if (effectiveRate == null || !Number.isFinite(effectiveRate) || effectiveRate < 0) throw AppError.conflict('Chưa có chính sách phạt vắng được xác minh cho kỳ này')
      item.amount = Math.round(hours * hourlyRate * effectiveRate)
    }
    const active = item.kind === 'ABSENCE' ? absence : item.hours > 0
    const fingerprint = createHash('sha256').update(JSON.stringify([details.fingerprint, details.policy, item, item.kind === 'ABSENCE' ? [hourlyRate, effectiveRate] : null])).digest('hex')
    const adjStatus = active ? (isDayApproved ? 'APPROVED' : 'PENDING') : 'VOID'
    const isUuid = (val: unknown): val is string => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
    const reviewerId = isDayApproved && isUuid(day.approved_by) ? day.approved_by : null
    if (previous?.source_fingerprint === fingerprint && previous.status === adjStatus) continue
    if (!previous && !active) continue
    const data = { ...item, source_fingerprint: fingerprint,
      source_details: { attendance_fingerprint: details.fingerprint ?? null, policy: details.policy ?? null,
        ...(item.kind === 'ABSENCE' ? { hourly_rate: hourlyRate, scheduled_hours: hours, absence_penalty_rate: effectiveRate } : {}) },
      status: adjStatus,
      reviewed_by: reviewerId,
      reviewed_at: isDayApproved ? (day.approved_at || null) : null,
    }
    const write = { ...key, ...data, note: previous?.note ?? (isDayApproved ? (day.approval_reason || day.overtime_reason || null) : null) }
    if (batch) batch.writes.push(write)
    else await tx.attendanceAdjustment.upsert({ where: { employee_id_work_date_kind: key }, create: write, update: { ...data } })
    if (previous) {
      const audit = { action: 'INVALIDATE_ADJUSTMENT_REVIEW', target_table: 'attendance_adjustments', record_id: String(previous.id),
        old_values: { status: previous.status, note: previous.note, source_fingerprint: previous.source_fingerprint },
        new_values: { status: data.status, source_fingerprint: fingerprint, reason: 'SOURCE_CHANGED' } }
      if (batch) batch.audits.push(audit)
      else await tx.auditLog.create({ data: audit })
    }
  }
}

export function adjustmentFingerprint(rows: Array<{ id: bigint; status: string; hours: unknown; amount: unknown; source_fingerprint: string; updated_at: Date }>) {
  return createHash('sha256').update(JSON.stringify([...rows].sort((a,b) => a.id < b.id ? -1 : 1)
    .map(r => [String(r.id), r.status, String(r.hours), String(r.amount), r.source_fingerprint, r.updated_at.toISOString()]))).digest('hex')
}

/** One round trip per batch, including updates to existing reviewed items. */
export async function flushAdjustmentBatch(tx: Prisma.TransactionClient, batch: AdjustmentBatch) {
  for (let offset = 0; offset < batch.writes.length; offset += 250) {
    const payload = JSON.stringify(batch.writes.slice(offset, offset + 250))
    await tx.$executeRaw`INSERT INTO attendance_adjustments
      (employee_id, work_date, kind, hours, amount, status, note, reviewed_by, reviewed_at, source_fingerprint, source_details)
      SELECT employee_id, work_date, kind, hours, amount, status, note, reviewed_by, reviewed_at, source_fingerprint, source_details
      FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(
        employee_id uuid, work_date date, kind text, hours numeric, amount numeric, status text,
        note text, reviewed_by uuid, reviewed_at timestamptz, source_fingerprint text, source_details jsonb)
      ON CONFLICT (employee_id, work_date, kind) DO UPDATE SET
        hours = EXCLUDED.hours, amount = EXCLUDED.amount, status = EXCLUDED.status,
        note = EXCLUDED.note, reviewed_by = EXCLUDED.reviewed_by, reviewed_at = EXCLUDED.reviewed_at,
        source_fingerprint = EXCLUDED.source_fingerprint, source_details = EXCLUDED.source_details,
        updated_at = clock_timestamp()`
  }
  if (batch.audits.length) await tx.auditLog.createMany({ data: batch.audits })
}
