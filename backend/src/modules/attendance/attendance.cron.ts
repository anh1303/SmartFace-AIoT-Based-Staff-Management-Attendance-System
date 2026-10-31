import { emitAttendanceEvent } from './attendance.gateway.js'
import { aggregateDailyAttendance } from './attendance.service.js'
import { getTodayVNString } from '../../common/utils.js'
import { logger } from '../../common/logger.js'
import { prisma } from '../../config/database.js'
import { randomUUID } from 'node:crypto'
import { runMissingScanAlerts } from './attendance.missing-alerts.js'

const cronLogger = logger.child('CronJob')

let running = false
let startupTimeout: NodeJS.Timeout | null = null
let cronInterval: NodeJS.Timeout | null = null
let alertsInterval: NodeJS.Timeout | null = null

/**
 * Tự động chạy tổng hợp chấm công định kỳ (mỗi giờ hoặc theo lịch).
 * Tự động cập nhật số giờ làm, OT, trễ/sớm cho toàn bộ nhân sự trong tháng hiện tại.
 */
export async function runAttendanceAggregationJob() {
  if (running) return
  running = true
  let activePeriod = ''
  try {
    const todayStr = getTodayVNString() // YYYY-MM-DD
    const [yearStr, monthStr] = todayStr.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    const previous = new Date(Date.UTC(year, month - 2, 1))
    for (const [targetMonth, targetYear] of [[previous.getUTCMonth() + 1, previous.getUTCFullYear()], [month, year]]) {
      activePeriod = `${targetYear}-${String(targetMonth).padStart(2, '0')}`
      const started = performance.now()
      const runId = randomUUID()
      cronLogger.info(`Bắt đầu tổng hợp chấm công kỳ ${activePeriod}`)
      try {
        await prisma.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${activePeriod}`}))`
          await tx.attendanceAggregationState.upsert({ where: { period: activePeriod }, create: { period: activePeriod, failed: true, run_id: runId }, update: { failed: true, run_id: runId } })
        })
        const result = await aggregateDailyAttendance(targetMonth, targetYear)
        await prisma.$transaction(async tx => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${activePeriod}`}))`
          await tx.attendanceAggregationState.updateMany({ where: { period: activePeriod, run_id: runId }, data: { failed: false } })
        })
        cronLogger.info(`Đã tổng hợp kỳ ${activePeriod}: ${result.totalSummaries} ngày công trong ${Math.round(performance.now() - started)} ms`)
        emitAttendanceEvent('attendance-summary-updated', { period: activePeriod })
      } catch (error) {
        cronLogger.error(`Lỗi khi tự động tổng hợp dữ liệu chấm công kỳ ${activePeriod}:`, error)
        try {
          await prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${activePeriod}`}))`
            const state = await tx.attendanceAggregationState.findUnique({ where: { period: activePeriod } })
            if (state && state.run_id !== runId) return
            await tx.attendanceAggregationState.upsert({ where: { period: activePeriod }, create: { period: activePeriod, failed: true, run_id: runId }, update: { failed: true } })
            const admins = await tx.user.findMany({ where: { is_active: true, roles: { role_name: 'ADMIN' } }, select: { id: true } })
            for (const admin of admins) await tx.systemNotification.upsert({
              where: { user_id_event_key: { user_id: admin.id, event_key: `aggregation-failed:${activePeriod}` } },
              create: { user_id: admin.id, event_key: `aggregation-failed:${activePeriod}`, title: 'Lỗi tổng hợp chấm công', message: `Kỳ ${activePeriod} tổng hợp thất bại và chưa thể khóa hoặc chốt. Vui lòng kiểm tra nhật ký hệ thống.` },
              update: { read_at: null, deleted_at: null, created_at: new Date() },
            })
          })
        } catch (alertError) { cronLogger.error(`Không thể lưu cảnh báo kỳ ${activePeriod}:`, alertError) }
      }
    }
  } catch (error) {
    cronLogger.error(`Lỗi khi tự động tổng hợp dữ liệu chấm công kỳ ${activePeriod}:`, error)
  } finally { running = false }
}

/**
 * Khởi động background cronjob định kỳ trong hệ thống.
 * Mặc định: Chạy kiểm tra mỗi 30 phút một lần.
 */
export function startAttendanceCron(intervalMs: number = 30 * 60 * 1000) {
  if (cronInterval) return

  // Chạy ngay lần đầu tiên khi khởi động sau 10 giây
  startupTimeout = setTimeout(() => {
    runAttendanceAggregationJob().catch(() => {})
    runMissingScanAlerts().catch(error => cronLogger.error('Không thể kiểm tra cảnh báo thiếu lượt chấm công:', error))
  }, 10000)

  cronInterval = setInterval(() => {
    runAttendanceAggregationJob().catch(() => {})
  }, intervalMs)
  alertsInterval = setInterval(() => {
    runMissingScanAlerts().catch(error => cronLogger.error('Không thể kiểm tra cảnh báo thiếu lượt chấm công:', error))
  }, 60_000)

  cronLogger.info(`Dịch vụ tổng hợp chấm công tự động đã được kích hoạt (chu kỳ ${Math.round(intervalMs / 60000)} phút).`)
}

export function stopAttendanceCron() {
  if (startupTimeout) { clearTimeout(startupTimeout); startupTimeout = null }
  if (alertsInterval) { clearInterval(alertsInterval); alertsInterval = null }
  if (cronInterval) {
    clearInterval(cronInterval)
    cronInterval = null
    cronLogger.info('Dịch vụ tổng hợp chấm công tự động đã dừng.')
  }
}
