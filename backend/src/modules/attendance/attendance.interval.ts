import { env } from '../../config/env.js'

/** One interval per employee, shared by CHECK_IN and CHECK_OUT. */
export function attendanceIntervalRemaining(createdAt: Date | string | null | undefined, now = Date.now()) {
  const minutes = env.ATTENDANCE_MIN_EVENT_INTERVAL_MINUTES ?? 10
  const acceptedAt = createdAt ? +new Date(createdAt) : NaN
  return Number.isFinite(acceptedAt) ? Math.max(0, Math.ceil((acceptedAt + minutes * 60_000 - now) / 1000)) : 0
}

export const attendanceIntervalMessage = (seconds: number) => `Lượt điểm danh gần đây đã được ghi nhận. Bỏ qua lượt quét lặp; vui lòng chờ ${seconds}s trước lần điểm danh tiếp theo.`
