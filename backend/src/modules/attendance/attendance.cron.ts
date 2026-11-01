import { aggregateDailyAttendance, autoCloseDueAttendance } from './attendance.service.js'
import { getTodayVNString } from '../../common/utils.js'
import { logger } from '../../common/logger.js'
import { prisma } from '../../config/database.js'
import { randomUUID } from 'node:crypto'
import { runMissingScanAlerts } from './attendance.missing-alerts.js'
import { eventBus } from '../../common/event-bus.js'
import { findActiveAdminUserIds } from '../auth/public.js'

const cronLogger = logger.child('CronJob')

let running = false
let startupTimeout: NodeJS.Timeout | null = null
let cronInterval: NodeJS.Timeout | null = null
let alertsInterval: NodeJS.Timeout | null = null

/**
 * Tác vụ tự động chốt công đến hạn:
 * Chỉ thực hiện khi đã đạt từ 00:05 VN của ngày kế tiếp.
 */
export async function runAutoCloseDueJob(asOf = new Date()) {
  try {
    await prisma.$executeRaw`DELETE FROM webhook_alert_dedup WHERE expires_at <= now()`
  } catch (err) {
    cronLogger.error('Không thể dọn khóa cảnh báo hết hạn:', err)
  }
  try {
    cronLogger.info('Kiểm tra và tự động chốt công đến hạn (từ 00:05 VN)...')
    const result = await autoCloseDueAttendance(asOf)
    if (result.closedCount > 0 || result.absentConvertedCount > 0) {
      cronLogger.info(`Tự chốt công hoàn tất: ${result.closedCount} ngày công APPROVED, ${result.absentConvertedCount} ca chuyển vắng mặt.`)
    }
  } catch (err) {
    cronLogger.error('Lỗi khi chạy autoCloseDueAttendance:', err)
  }
}

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
        eventBus.publish('attendance:summary-updated', { period: activePeriod, summary: { period: activePeriod } })
      } catch (error) {
        cronLogger.error(`Lỗi khi tự động tổng hợp dữ liệu chấm công kỳ ${activePeriod}:`, error)
        try {
          await prisma.$transaction(async tx => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll:${activePeriod}`}))`
            const state = await tx.attendanceAggregationState.findUnique({ where: { period: activePeriod } })
            if (state && state.run_id !== runId) return
            await tx.attendanceAggregationState.upsert({ where: { period: activePeriod }, create: { period: activePeriod, failed: true, run_id: runId }, update: { failed: true } })
            const adminIds = await findActiveAdminUserIds(tx)
            for (const adminId of adminIds) await tx.systemNotification.upsert({
              where: { user_id_event_key: { user_id: adminId, event_key: `aggregation-failed:${activePeriod}` } },
              create: { user_id: adminId, event_key: `aggregation-failed:${activePeriod}`, title: 'Lỗi tổng hợp chấm công', message: `Kỳ ${activePeriod} tổng hợp thất bại và chưa thể khóa hoặc chốt. Vui lòng kiểm tra nhật ký hệ thống.` },
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

let exactMidnightTimeout: NodeJS.Timeout | null = null

function getMsUntilNext0005VN(): number {
  const now = new Date()
  const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
  const vnTarget = new Date(vnNow)
  vnTarget.setUTCHours(0, 5, 0, 0)
  if (vnTarget.getTime() <= vnNow.getTime()) {
    vnTarget.setUTCDate(vnTarget.getUTCDate() + 1)
  }
  return vnTarget.getTime() - vnNow.getTime()
}

function scheduleNext0005Job() {
  const delay = getMsUntilNext0005VN()
  cronLogger.info(`Đã lên lịch tự động chốt công chính xác lúc 00:05 VN tiếp theo (sau ${Math.round(delay / 60000)} phút).`)
  exactMidnightTimeout = setTimeout(async () => {
    try {
      cronLogger.info('Kích hoạt tác vụ tự chốt công định kỳ chính xác lúc 00:05 VN...')
      await runAutoCloseDueJob()
      await runAttendanceAggregationJob()
    } catch (err) {
      cronLogger.error('Lỗi khi chạy tác vụ tự chốt lúc 00:05 VN:', err)
    } finally {
      scheduleNext0005Job()
    }
  }, delay)
}

/**
 * Khởi động background cronjob định kỳ trong hệ thống.
 * - Chạy bù khi khởi động sau 10 giây (tự chốt có chốt chặn 00:05 VN bảo đảm an toàn).
 * - Lên lịch cố định chính xác 00:05 mỗi ngày theo giờ VN.
 * - Chạy tổng hợp chấm công định kỳ mỗi 30 phút.
 */
export function startAttendanceCron(intervalMs: number = 30 * 60 * 1000) {
  if (cronInterval) return

  // 1. Chạy bù ngay lần đầu tiên khi khởi động sau 10 giây
  startupTimeout = setTimeout(async () => {
    await runAutoCloseDueJob()
    runAttendanceAggregationJob().catch(() => {})
    runMissingScanAlerts().catch(error => cronLogger.error('Không thể kiểm tra cảnh báo thiếu lượt chấm công:', error))
  }, 10000)

  // 2. Lên lịch đúng 00:05 VN hàng ngày
  scheduleNext0005Job()

  // 3. Chu kỳ định kỳ (30 phút): Kiểm tra tự chốt các ca đã hết hạn OT 4h và tổng hợp chấm công
  cronInterval = setInterval(async () => {
    await runAutoCloseDueJob()
    runAttendanceAggregationJob().catch(() => {})
  }, intervalMs)
  alertsInterval = setInterval(() => {
    runMissingScanAlerts().catch(error => cronLogger.error('Không thể kiểm tra cảnh báo thiếu lượt chấm công:', error))
  }, 60_000)

  cronLogger.info(`Dịch vụ tổng hợp chấm công tự động đã được kích hoạt (00:05 VN, chạy bù khởi động & chu kỳ ${Math.round(intervalMs / 60000)} phút).`)
}

export function stopAttendanceCron() {
  if (startupTimeout) { clearTimeout(startupTimeout); startupTimeout = null }
  if (exactMidnightTimeout) { clearTimeout(exactMidnightTimeout); exactMidnightTimeout = null }
  if (alertsInterval) { clearInterval(alertsInterval); alertsInterval = null }
  if (cronInterval) {
    clearInterval(cronInterval)
    cronInterval = null
    cronLogger.info('Dịch vụ tổng hợp chấm công tự động đã dừng.')
  }
}

