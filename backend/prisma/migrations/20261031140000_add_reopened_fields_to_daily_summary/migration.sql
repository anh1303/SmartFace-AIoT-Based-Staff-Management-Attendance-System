-- AlterTable
ALTER TABLE "daily_attendance_summary"
ADD COLUMN IF NOT EXISTS "reopened_at" TIMESTAMPTZ(6),
ADD COLUMN IF NOT EXISTS "reopened_by" VARCHAR(100);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_daily_summary_reopened_at" ON "daily_attendance_summary"("reopened_at");
