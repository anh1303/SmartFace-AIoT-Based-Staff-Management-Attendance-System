import { Prisma } from '@prisma/client'

/**
 * Tạo snapshot đầy đủ dữ liệu ngày công trước khi duyệt / điều chỉnh / tự chốt.
 */
export function createAttendanceSnapshot(summary: Record<string, any>): Record<string, any> {
  return {
    total_working_hours: Number(summary.total_working_hours ?? 0),
    late_early: Number(summary.late_early ?? 0),
    overtime: Number(summary.overtime ?? 0),
    regular_seconds: Number(summary.regular_seconds ?? 0),
    overtime_seconds: Number(summary.overtime_seconds ?? 0),
    late_early_seconds: Number(summary.late_early_seconds ?? 0),
    attendance_status: summary.attendance_status ?? 'PRESENT',
    review_status: summary.review_status || 'NONE',
    requires_review: Boolean(summary.requires_review),
    review_reason: summary.review_reason ?? null,
    overtime_status: summary.overtime_status ?? 'NONE',
    overtime_candidate_hours: Number(summary.overtime_candidate_hours ?? 0),
    manual_adjustment: Boolean(summary.manual_adjustment),
    calculation_details: summary.calculation_details ?? null,
  }
}

/**
 * Khôi phục đầy đủ dữ liệu ngày công từ snapshot khi mở khóa.
 */
export function restoreAttendanceFromSnapshot(
  summary: Record<string, any>,
  snapshot: Record<string, any>,
  options?: { isPersonalUnlock?: boolean; reopenedBy?: string }
) {
  const restoredDetails = snapshot.calculation_details
    ? { ...(snapshot.calculation_details as Record<string, any>) }
    : { ...((summary.calculation_details as any) || {}) }

  const restoredStatus = snapshot.review_status === 'APPROVED'
    ? (Boolean(snapshot.requires_review) || Number(snapshot.overtime_candidate_hours ?? 0) > 0 || Number(snapshot.late_early ?? 0) > 0 || Boolean(restoredDetails.absenceCandidate) ? 'PENDING' : 'NONE')
    : (snapshot.review_status ?? 'NONE')

  return {
    total_working_hours: snapshot.total_working_hours ?? summary.total_working_hours,
    late_early: snapshot.late_early ?? summary.late_early,
    overtime: snapshot.overtime ?? 0,
    regular_seconds: snapshot.regular_seconds ?? summary.regular_seconds,
    overtime_seconds: snapshot.overtime_seconds ?? summary.overtime_seconds,
    late_early_seconds: snapshot.late_early_seconds ?? summary.late_early_seconds,
    overtime_candidate_hours: snapshot.overtime_candidate_hours ?? summary.overtime_candidate_hours,
    overtime_status: snapshot.overtime_status ?? (Number(snapshot.overtime_candidate_hours ?? 0) > 0 ? 'PENDING' : 'NONE'),
    attendance_status: snapshot.attendance_status ?? summary.attendance_status,
    review_status: restoredStatus,
    requires_review: Boolean(snapshot.requires_review),
    review_reason: snapshot.review_reason ?? summary.review_reason,
    manual_adjustment: Boolean(snapshot.manual_adjustment),
    calculation_details: restoredDetails,
    approved_by: null,
    approved_at: null,
    approval_source: null,
    approval_reason: null,
    pre_approval_snapshot: Prisma.DbNull,
    reopened_at: options?.isPersonalUnlock ? new Date() : null,
    reopened_by: options?.isPersonalUnlock ? (options.reopenedBy ?? null) : null,
  }
}

