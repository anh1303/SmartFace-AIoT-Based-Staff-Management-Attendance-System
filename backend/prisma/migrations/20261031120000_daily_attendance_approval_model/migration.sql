-- AlterTable
ALTER TABLE "daily_attendance_summary"
ADD COLUMN IF NOT EXISTS "review_status" VARCHAR(20) NOT NULL DEFAULT 'NONE',
ADD COLUMN IF NOT EXISTS "approval_source" VARCHAR(50),
ADD COLUMN IF NOT EXISTS "pre_approval_snapshot" JSONB,
ADD COLUMN IF NOT EXISTS "approval_reason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_daily_summary_review_status" ON "daily_attendance_summary"("review_status");
