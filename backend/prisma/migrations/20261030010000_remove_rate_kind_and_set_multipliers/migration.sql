-- 1. Drop rate kind columns from bonus_penalty
ALTER TABLE "bonus_penalty"
  DROP COLUMN IF EXISTS "overtime_rate_kind",
  DROP COLUMN IF EXISTS "late_early_penalty_kind";

-- 2. Update default multiplier values in bonus_penalty: OT 2.0, Late 1.5, Absence 2.0
ALTER TABLE "bonus_penalty"
  ALTER COLUMN "overtime_rate" SET DEFAULT 2.0,
  ALTER COLUMN "late_early_penalty" SET DEFAULT 1.5,
  ALTER COLUMN "absence_penalty_rate" SET DEFAULT 2.0;

-- 3. Update existing active bonus_penalty records to new multiplier values
UPDATE "bonus_penalty" SET
  "overtime_rate" = 2.0,
  "late_early_penalty" = 1.5,
  "absence_penalty_rate" = 2.0,
  "description" = 'Chính sách hệ số: OT 2.0x, phạt trễ/sớm 1.5x, phạt vắng 2.0x',
  "updated_at" = NOW();

-- 4. Drop rate kind columns from payroll_records
ALTER TABLE "payroll_records"
  DROP COLUMN IF EXISTS "overtime_rate_kind",
  DROP COLUMN IF EXISTS "late_penalty_rate_kind";

-- 5. Drop enum RateKind
DROP TYPE IF EXISTS "RateKind";
