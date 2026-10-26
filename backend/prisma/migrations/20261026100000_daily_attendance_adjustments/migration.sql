ALTER TABLE "bonus_penalty" ADD COLUMN "absence_penalty_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.25;
ALTER TABLE "payroll_records" ADD COLUMN "total_absence_penalty" DECIMAL(15,2) NOT NULL DEFAULT 0;
CREATE TABLE "attendance_adjustments" (
  "id" BIGSERIAL PRIMARY KEY,
  "employee_id" UUID NOT NULL REFERENCES "employees"("id") ON UPDATE NO ACTION,
  "work_date" DATE NOT NULL,
  "kind" VARCHAR(20) NOT NULL CHECK ("kind" IN ('OVERTIME', 'LATE_EARLY', 'ABSENCE')),
  "hours" DECIMAL(7,2) NOT NULL DEFAULT 0 CHECK ("hours" >= 0),
  "amount" DECIMAL(15,2) NOT NULL DEFAULT 0 CHECK ("amount" >= 0),
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK ("status" IN ('PENDING', 'APPROVED', 'REJECTED', 'VOID')),
  "note" TEXT,
  "reviewed_by" UUID REFERENCES "users"("id") ON UPDATE NO ACTION,
  "reviewed_at" TIMESTAMPTZ(6),
  "source_fingerprint" VARCHAR(64) NOT NULL,
  "source_details" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("employee_id", "work_date", "kind")
);
CREATE INDEX "attendance_adjustments_work_date_status_idx" ON "attendance_adjustments"("work_date", "status");
-- Existing locked/paid payroll is preserved. Unlocked days are proposed for review
-- by the regular aggregation job; existing approvals are copied by the application.
