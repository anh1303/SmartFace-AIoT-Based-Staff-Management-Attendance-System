import { createHash } from 'node:crypto'

type HoursOverride = { value: number; basis_fingerprint: string | null; reason: string }
type RateOverride = { value: number; reason: string }
export type FieldOverrides = { working_hours?: HoursOverride; hourly_rate?: RateOverride }

export function payrollOverrides(record: { calculation_details?: unknown; total_working_hours: unknown; hourly_rate: unknown } | null) {
  const details = (record?.calculation_details || {}) as Record<string, any>
  const legacy = Boolean(details.legacy_manual_unresolved || details.manual && !details.field_overrides)
  const fields: FieldOverrides = { ...(details.field_overrides || {}) }
  // Preserve uncertain legacy edits until an operator explicitly reconciles both values.
  if (legacy && record) {
    fields.working_hours ??= { value: Number(record.total_working_hours), basis_fingerprint: null, reason: details.reason || 'LEGACY_MANUAL' }
    fields.hourly_rate ??= { value: Number(record.hourly_rate), reason: details.reason || 'LEGACY_MANUAL' }
  }
  return { fields, legacy }
}

export function workingHoursFingerprint(rows: Array<{ id: bigint; work_date: Date; total_working_hours: unknown; policy_version: string | null; calculation_details: unknown }>) {
  return createHash('sha256').update(JSON.stringify([...rows].sort((a, b) => a.id < b.id ? -1 : 1).map(row => [
    String(row.id), row.work_date.toISOString().slice(0, 10), String(row.total_working_hours), row.policy_version,
    (row.calculation_details as Record<string, unknown> | null)?.fingerprint,
  ]))).digest('hex')
}

export function requiresHoursReconciliation(fields: FieldOverrides, legacy: boolean, source: string) {
  return legacy || Boolean(fields.working_hours && fields.working_hours.basis_fingerprint !== source)
}
