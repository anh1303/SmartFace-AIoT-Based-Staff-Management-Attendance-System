import 'dotenv/config'
import { PrismaClient, type Prisma } from '@prisma/client'
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Real database timings; generated business rows are always rolled back.
const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('=')
  return [key, value.join('=')] as const
}))
const period = args.get('period') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7)
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Invalid period')
const runs = Number(args.get('runs') || 3)
if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error('Use 1 to 5 runs')
const db = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] })
let stage = 'inspect'
let queries: Array<{ stage: string; action: string; ms: number }> = []
let sql: Array<{ stage: string; ms: number; lock: boolean; group: string }> = []
db.$use(async (params, next) => {
  const started = performance.now(), currentStage = stage
  try { return await next(params) }
  finally { queries.push({ stage: currentStage, action: `${params.model || 'raw'}.${params.action}`, ms: performance.now() - started }) }
})
db.$on('query', event => {
  const verb = event.query.match(/^\s*(\w+)/)?.[1] || 'OTHER'
  const table = event.query.match(/(?:FROM|INTO|UPDATE)\s+"?(?:public"?\.)?"?(\w+)/i)?.[1] || 'control'
  sql.push({ stage, ms: event.duration, lock: event.query.includes('pg_advisory_xact_lock'), group: `${stage}:${verb}:${table}` })
})
let activeTx: Prisma.TransactionClient | undefined
let transactionIndex = 0
const stages: Array<{ stage: string; ms: number }> = []
const proxy = new Proxy(db, {
  get(target, property) {
    if (activeTx && property === '$transaction') return async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      const previous = stage
      stage = ++transactionIndex === 1 ? 'aggregate_month' : 'generate_payroll'
      const started = performance.now()
      try { return await callback(activeTx!) }
      finally { stages.push({ stage, ms: performance.now() - started }); stage = previous }
    }
    const owner = activeTx || target
    const value = Reflect.get(owner, property)
    return typeof value === 'function' ? value.bind(owner) : value
  },
})
;(globalThis as any).prisma = proxy
const round = (n: number) => Math.round(n * 10) / 10
function summary() {
  const actions = new Map<string, { count: number; ms: number; max_ms: number }>()
  for (const query of queries) {
    const key = `${query.stage}:${query.action}`
    const entry = actions.get(key) || { count: 0, ms: 0, max_ms: 0 }
    entry.count++; entry.ms += query.ms; entry.max_ms = Math.max(entry.max_ms, query.ms); actions.set(key, entry)
  }
  return {
    stages: stages.map(item => ({ ...item, ms: round(item.ms) })),
    prisma_operations: queries.length, sql_queries: sql.length,
    sql_duration_ms: sql.reduce((sum, item) => sum + item.ms, 0),
    lock_sql_ms: sql.filter(item => item.lock).reduce((sum, item) => sum + item.ms, 0),
    sql_groups: [...new Set(sql.map(item => item.group))].map(group => {
      const items = sql.filter(item => item.group === group)
      return { group, count: items.length, total_ms: items.reduce((sum, item) => sum + item.ms, 0) }
    }).sort((a, b) => b.total_ms - a.total_ms),
    actions: [...actions].map(([action, item]) => ({ action, count: item.count, total_ms: round(item.ms), max_ms: round(item.max_ms) })).sort((a, b) => b.total_ms - a.total_ms),
  }
}
const results: any = { period, measured_at: new Date().toISOString(), method: 'real database; generation inside one rollback-only outer transaction; no HTTP/browser timing', runs: [] }
try {
  const started = performance.now()
  await db.$queryRaw`SELECT 1`
  results.connection_first_query_ms = round(performance.now() - started)
  results.ping_ms = []
  for (let i = 0; i < 5; i++) {
    const before = performance.now(); await db.$queryRaw`SELECT 1`; results.ping_ms.push(round(performance.now() - before))
  }
  const [year, month] = period.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1)), end = new Date(Date.UTC(year, month, 1))
  results.data = {
    employees: await db.employee.count(),
    active_employees: await db.employee.count({ where: { status: 'ACTIVE' } }),
    month_logs: await db.attendance_logs.count({ where: { event_time: { gte: start, lt: end } } }),
    month_shifts: await db.employee_shifts.count({ where: { work_date: { gte: start, lt: end } } }),
    month_summaries: await db.daily_attendance_summary.count({ where: { work_date: { gte: start, lt: end } } }),
    payroll_statuses: await db.payrollRecord.groupBy({ by: ['status'], where: { payroll_period: period }, _count: true }),
    all_payroll_records: await db.payrollRecord.count(),
  }
  console.info(JSON.stringify({ connection_first_query_ms: results.connection_first_query_ms, ping_ms: results.ping_ms, data: results.data }))
  if (args.get('mode') === 'measure') {
    await import('../src/composition.js')
    const payroll = await import('../src/modules/payroll/payroll.service.js')
    const admin = await db.user.findFirst({ where: { is_active: true, roles: { role_name: 'ADMIN' } }, select: { id: true } })
    if (!admin) throw new Error('No active admin for scope')
    const snapshot = async () => createHash('sha256').update(JSON.stringify(await db.payrollRecord.findMany({ where: { payroll_period: period }, orderBy: { id: 'asc' } }), (_key, value) => typeof value === 'bigint' ? value.toString() : value)).digest('hex')
    const beforeHash = await snapshot()
    for (let i = 0; i < runs; i++) {
      for (const selected of [period, undefined]) {
        stage = selected ? 'list_month' : 'list_all'; queries = []; sql = []; stages.length = 0
        const before = performance.now()
        const rows = await payroll.list(selected, undefined, { id: admin.id, role: 'ADMIN' })
        results.runs.push({ run: i + 1, operation: stage, ms: round(performance.now() - before), rows: rows.length, ...summary() })
        console.info(JSON.stringify(results.runs.at(-1)))
      }
      stage = 'generate_preflight'; queries = []; sql = []; stages.length = 0; transactionIndex = 0
      const before = performance.now(), rollback = new Error('BENCHMARK_ROLLBACK')
      let generated = 0
      let financialSignature = ''
      try {
        await db.$transaction(async tx => {
          activeTx = tx
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '1500ms'")
          const generatedRows = await payroll.generate(period, undefined, admin.id, { id: admin.id, role: 'ADMIN' })
          generated = generatedRows.length
          financialSignature = createHash('sha256').update(JSON.stringify(generatedRows.map(row => ({
            employee: row.employee_id, period: row.period, hourly_rate: row.hourly_rate,
            hours: row.total_working_hours, overtime: row.total_overtime, late: row.total_late_early,
            absence: row.total_absence_penalty, absence_count: row.approved_absence_count,
            allowance: row.allowance, net: row.net_salary, overtime_rate: row.overtime_rate,
            late_rate: row.late_penalty_rate, breakdown: row.breakdown,
            source: (row.calculation_details as Record<string, unknown>).source_fingerprint,
            adjustments: (row.calculation_details as Record<string, unknown>).adjustment_fingerprint,
          })).sort((a, b) => a.employee.localeCompare(b.employee)))).digest('hex')
          throw rollback
        }, { timeout: 120000, maxWait: 5000 })
      } catch (error) { if (error !== rollback) throw error }
      finally { activeTx = undefined }
      results.runs.push({ run: i + 1, operation: 'generate_rollback', ms: round(performance.now() - before), rows: generated, financial_sha256: financialSignature, ...summary() })
      console.info(JSON.stringify(results.runs.at(-1)))
    }
    results.payroll_unchanged_after_rollback = beforeHash === await snapshot()
    if (!results.payroll_unchanged_after_rollback) throw new Error('Payroll snapshot changed; check concurrent activity')
  }
} catch (error: any) {
  results.error = { name: error?.name, code: error?.code, reason: error?.message?.startsWith('Payroll snapshot') ? error.message : undefined }
  console.error(JSON.stringify({ error: results.error }))
  process.exitCode = 1
} finally {
  await db.$disconnect()
  const output = args.get('output')
  if (output) { await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(results, null, 2) + '\n') }
}
