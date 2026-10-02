import { aggregateDailyAttendance } from './attendance.service.js'
import { getTodayVNString } from '../../common/utils.js'
import { logger } from '../../common/logger.js'

const cronLogger = logger.child('CronJob')

let cronInterval: NodeJS.Timeout | null = null

/**
 * Tự động chạy tổng hợp chấm công định kỳ (mỗi giờ hoặc theo lịch).
 * Tự động cập nhật số giờ làm, OT, trễ/sớm cho toàn bộ nhân sự trong tháng hiện tại.
 */
export async function runAttendanceAggregationJob() {
  try {
    const todayStr = getTodayVNString() // YYYY-MM-DD
    const [yearStr, monthStr] = todayStr.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)

    cronLogger.info(`Đang tự động tổng hợp dữ liệu chấm công tháng ${month}/${year}...`)
    const result = await aggregateDailyAttendance(month, year)
    cronLogger.info(`Đã tổng hợp thành công ${result.totalSummaries} bản ghi chấm công ngày tháng ${month}/${year}`)
  } catch (error) {
    cronLogger.error('Lỗi khi tự động tổng hợp dữ liệu chấm công:', error)
  }
}

/**
 * Khởi động background cronjob định kỳ trong hệ thống.
 * Mặc định: Chạy kiểm tra mỗi 30 phút một lần.
 */
export function startAttendanceCron(intervalMs: number = 30 * 60 * 1000) {
  if (cronInterval) return

  // Chạy ngay lần đầu tiên khi khởi động sau 10 giây
  setTimeout(() => {
    runAttendanceAggregationJob().catch(() => {})
  }, 10000)

  cronInterval = setInterval(() => {
    runAttendanceAggregationJob().catch(() => {})
  }, intervalMs)

  cronLogger.info(`Dịch vụ tổng hợp chấm công tự động đã được kích hoạt (chu kỳ ${Math.round(intervalMs / 60000)} phút).`)
}

export function stopAttendanceCron() {
  if (cronInterval) {
    clearInterval(cronInterval)
    cronInterval = null
    cronLogger.info('Dịch vụ tổng hợp chấm công tự động đã dừng.')
  }
}
