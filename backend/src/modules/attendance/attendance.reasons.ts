/** Shared API contract for attendance evidence and review reasons. */
export const ATTENDANCE_REASON_LABELS: Record<string, string> = {
  MISSING_CHECK_OUT: 'Thiếu lượt check-out',
  NO_VALID_PAIR: 'Không có cặp vào và ra hợp lệ',
  INVALID_PAIR: 'Cặp vào và ra không hợp lệ',
  FLAGGED_EVENT: 'Có lượt chấm công cần xác minh',
  UNPAIRED_CHECK_OUT: 'Thiếu check-in cho lượt check-out',
  REPLACED_CHECK_IN: 'Lượt check-in được thay bằng lượt vào sau',
  INTERRUPTED_PAIR: 'Cặp vào và ra bị gián đoạn',
  UNDER_MINIMUM_SHIFT: 'Chưa đạt ngưỡng 2/3 ca',
  MINIMUM_SHIFT_REACHED: 'Đã đạt ngưỡng 2/3 ca',
  MINIMUM_SHIFT_NOT_YET_REACHED: 'Chưa đạt ngưỡng 2/3 ca tại lượt này',
  UNDER_HALF_SHIFT: 'Chưa đạt ngưỡng nửa ca',
  HALF_SHIFT_REACHED: 'Đã đạt ngưỡng nửa ca',
  HALF_SHIFT_NOT_YET_REACHED: 'Chưa đạt ngưỡng nửa ca tại lượt này',
  FULL_SHIFT_ALREADY_CREDITED: 'Công cả ca đã ghi ở lượt check-out trước',
  OFF: 'Ngày OFF, không tự ghi công',
  NO_SHIFT: 'Chưa phân ca',
  OT_OVER_4H: 'Tăng ca vượt 4 giờ cần xác minh',
  SOURCE_CHANGED: 'Dữ liệu chấm công đã thay đổi, cần tổng hợp lại',
  SOURCE_CHANGED_AFTER_REVIEW: 'Dữ liệu thay đổi sau khi đã duyệt',
  SHIFT_CHANGED: 'Lịch làm việc đã thay đổi',
}

/** Correct the display of frozen summaries without rewriting historical data. */
export function displayAttendanceStatus(status: string, reviewReason: string | null, details?: unknown): string {
  const reasons = new Set((reviewReason || '').split(','))
  const evidence = details && typeof details === 'object' ? details as Record<string, unknown> : null
  const orphan = Array.isArray(evidence?.pairs) && evidence.pairs.length === 0 && Array.isArray(evidence.ignored)
    && evidence.ignored.some((entry: { reason?: string }) => entry.reason === 'UNPAIRED_CHECK_OUT')
  return status === 'PRESENT' && (orphan || reasons.has('NO_VALID_PAIR') && reasons.has('UNPAIRED_CHECK_OUT')) ? 'INCOMPLETE' : status
}
