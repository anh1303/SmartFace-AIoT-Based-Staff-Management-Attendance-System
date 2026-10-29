import { AppError } from '../../common/AppError.js'

type WageProfile = { hourly_rate?: unknown; hourly_rate_history?: unknown }
type WageEntry = { period: string; rate: number }
const BASELINE_PERIOD = '0000-01'
const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

function historyOf(employee: WageProfile): WageEntry[] {
  const history = employee.hourly_rate_history ?? []
  if (!Array.isArray(history) || history.some(row => !row || !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) || !Number.isFinite(row.rate) || row.rate < 0)) {
    throw AppError.conflict('Lịch sử lương giờ không hợp lệ; cần đối soát trước khi tính lương')
  }
  return [...history].sort((a, b) => a.period.localeCompare(b.period))
}

/** Profile changes apply to their whole VN month. Legacy saved months retain their snapshot. */
export function monthlyHourlyRate(employee: WageProfile, period: string, savedRate?: unknown): number {
  const currentPeriod = vnDate.format(new Date()).slice(0, 7)
  if (period >= currentPeriod) return Number(employee.hourly_rate ?? 0)
  const effective = historyOf(employee).filter(row => row.period <= period).at(-1)
  if (effective && effective.period !== BASELINE_PERIOD) return effective.rate
  if (savedRate != null) return Number(savedRate)
  return effective?.rate ?? Number(employee.hourly_rate ?? 0)
}

export function recordHourlyRateChange(employee: WageProfile, rate: number, period: string): WageEntry[] {
  const history = historyOf(employee)
  if (!history.length) history.push({ period: BASELINE_PERIOD, rate: Number(employee.hourly_rate ?? 0) })
  return [...history.filter(row => row.period !== period), { period, rate }].sort((a, b) => a.period.localeCompare(b.period))
}
