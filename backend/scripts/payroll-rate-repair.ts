import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { Prisma } from '@prisma/client'
import { prisma } from '../src/config/database.js'
import { historicalBreakdown, reconciliationSchema } from '../src/common/payroll-history.js'

// Default mode is a read-only audit. Applying requires a verified input file and
// optimistic checks against both the saved timestamp and saved net salary.
const args = process.argv.slice(2)
const apply = args.includes('--apply')
const exportOriginals = args.includes('--export-originals')
const inputPath = args.find(arg => !arg.startsWith('--'))
try {
  const input = inputPath ? reconciliationSchema.parse(JSON.parse(await readFile(inputPath, 'utf8'))) : null
  if (apply && !input) throw new Error('--apply requires a verified reconciliation JSON file')
  const report = await prisma.$transaction(async tx => {
    if (!apply) await tx.$executeRaw`SET TRANSACTION READ ONLY`
    else await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payroll-rate-repair'))`
    if (apply) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('payroll-policy'))`
    const migrations = await tx.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at`
    const original_records = exportOriginals ? await tx.$queryRaw<Array<{ original_record: Prisma.JsonObject }>>`SELECT to_jsonb(p) AS original_record FROM payroll_records p ORDER BY id` : []
    const original_policies = exportOriginals ? await tx.$queryRaw<Array<{ original_policy: Prisma.JsonObject }>>`SELECT to_jsonb(b) AS original_policy FROM bonus_penalty b ORDER BY id` : []
    for (const policy of input?.policies ?? []) {
      if (await tx.bonusPenalty.findUnique({ where: { effective_period: policy.effective_period } })) throw new Error(`Policy ${policy.effective_period} already exists; cannot overwrite it`)
      if (apply) {
        const saved = await tx.bonusPenalty.create({ data: { ...policy, description: `Verified import: ${input!.source_reference}`.slice(0, 255) } })
        await tx.auditLog.create({ data: { action: 'IMPORT_VERIFIED_PAYROLL_POLICY', target_table: 'bonus_penalty', record_id: String(saved.id),
          new_values: { ...policy, source_reference: input!.source_reference } } })
      }
    }
    const rows = await tx.payrollRecord.findMany({ where: input ? { id: { in: input.records.map(row => BigInt(row.id)) } } : {}, orderBy: { id: 'asc' } })
    if (input && rows.length !== input.records.length) throw new Error('One or more payroll IDs do not exist')
    const observations = []
    for (const row of rows) {
      const details = (row.calculation_details ?? {}) as Prisma.JsonObject
      const supplied = input?.records.find(item => item.id === String(row.id))
      if (supplied) {
        if (row.updated_at.toISOString() !== supplied.expected_updated_at || Number(row.net_salary) !== supplied.expected_net_salary) throw new Error(`Payroll ${row.id} changed; audit it again`)
        if (details.rate_snapshot_status !== 'UNRESOLVED' && !(supplied.prepare_pending_recalculation && row.status === 'PENDING' && details.rate_snapshot_status === 'LEGACY_VERIFIED')) {
          throw new Error(`Payroll ${row.id} is not unresolved or a verified pending record awaiting recalculation`)
        }
        const verified = { source_reference: input!.source_reference, overtime: supplied.overtime, late: supplied.late }
        const preparePending = supplied.prepare_pending_recalculation === true
        if (preparePending && row.status !== 'PENDING') throw new Error(`Payroll ${row.id}: only PENDING records can be prepared for recalculation`)
        const calculation_details = { ...details, rate_snapshot_status: preparePending ? 'MULTIPLIER' : 'LEGACY_VERIFIED', verified_legacy_rates: verified,
          ...(preparePending ? { needs_recalculation: true, source_fingerprint: null, adjustment_fingerprint: null } : {}) }
        const breakdown = historicalBreakdown({ calculation_details, hourly_rate: Number(row.hourly_rate), total_working_hours: Number(row.total_working_hours),
          total_overtime: Number(row.total_overtime), total_late_early: Number(row.total_late_early), allowance: Number(row.allowance), total_absence_penalty: Number(row.total_absence_penalty) })!
        if (!preparePending && breakdown?.net_salary !== Number(row.net_salary)) throw new Error(`Payroll ${row.id}: verified units do not reproduce saved net salary; manual reconciliation required`)
        if (apply) {
          const result = await tx.payrollRecord.updateMany({ where: { id: row.id, updated_at: row.updated_at, net_salary: row.net_salary }, data: { calculation_details,
            ...(preparePending ? { overtime_rate: supplied.overtime.value, late_penalty_rate: supplied.late.value } : {}) } })
          if (result.count !== 1) throw new Error(`Payroll ${row.id} changed during reconciliation`)
          await tx.auditLog.create({ data: { action: 'VERIFY_LEGACY_PAYROLL_RATES', target_table: 'payroll_records', record_id: String(row.id),
            old_values: { rate_snapshot_status: details.rate_snapshot_status }, new_values: verified } })
        }
      }
      observations.push({ id: String(row.id), period: row.payroll_period, status: row.status, updated_at: row.updated_at.toISOString(),
        net_salary: String(row.net_salary), overtime_rate: row.overtime_rate?.toString() ?? null, late_penalty_rate: row.late_penalty_rate?.toString() ?? null,
        rate_snapshot_status: details.rate_snapshot_status ?? null, proposed: supplied ? supplied.prepare_pending_recalculation ? 'MULTIPLIER; explicit regeneration required; money unchanged' : 'LEGACY_VERIFIED; money unchanged' : null })
    }
    return { mode: apply ? 'applied' : 'read-only', migrations, records: observations,
      proposed_policies: input?.policies ?? [], ...(exportOriginals ? { original_records: original_records.map(row => row.original_record), original_policies: original_policies.map(row => row.original_policy) } : {}) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Payroll repair failed')
  process.exitCode = 1
} finally { await prisma.$disconnect() }
