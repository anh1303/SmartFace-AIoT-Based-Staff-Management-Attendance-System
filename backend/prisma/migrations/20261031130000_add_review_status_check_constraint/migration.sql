-- Add check constraint for review_status in daily_attendance_summary
ALTER TABLE "daily_attendance_summary"
ADD CONSTRAINT "chk_daily_summary_review_status"
CHECK ("review_status" IN ('NONE', 'PENDING', 'APPROVED'));
