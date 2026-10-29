CREATE TYPE "RateKind" AS ENUM ('FIXED_PER_HOUR', 'HOURLY_MULTIPLIER');

ALTER TABLE bonus_penalty
  ADD COLUMN overtime_rate_kind "RateKind" NOT NULL DEFAULT 'FIXED_PER_HOUR',
  ADD COLUMN late_early_penalty_kind "RateKind" NOT NULL DEFAULT 'FIXED_PER_HOUR';

-- Capture the old application's units once without repricing existing policies.
UPDATE bonus_penalty SET
  overtime_rate_kind = CASE WHEN overtime_rate <= 10 THEN 'HOURLY_MULTIPLIER'::"RateKind" ELSE 'FIXED_PER_HOUR'::"RateKind" END,
  late_early_penalty_kind = CASE WHEN late_early_penalty <= 10 THEN 'HOURLY_MULTIPLIER'::"RateKind" ELSE 'FIXED_PER_HOUR'::"RateKind" END;

ALTER TABLE bonus_penalty
  ALTER COLUMN overtime_rate SET DEFAULT 100000,
  ALTER COLUMN late_early_penalty SET DEFAULT 50000,
  ALTER COLUMN absence_penalty_rate SET DEFAULT 0.25;

ALTER TABLE payroll_records
  ADD COLUMN overtime_rate_kind "RateKind",
  ADD COLUMN late_penalty_rate_kind "RateKind";

-- Missing historical snapshots remain unresolved; never substitute today's policy.
-- Preserve every saved numeric rate, net salary, and calculation detail.
UPDATE payroll_records SET
  overtime_rate_kind = CASE
    WHEN overtime_rate IS NULL THEN NULL
    WHEN overtime_rate <= 10 THEN 'HOURLY_MULTIPLIER'::"RateKind"
    ELSE 'FIXED_PER_HOUR'::"RateKind" END,
  late_penalty_rate_kind = CASE
    WHEN late_penalty_rate IS NULL THEN NULL
    WHEN late_penalty_rate <= 10 THEN 'HOURLY_MULTIPLIER'::"RateKind"
    ELSE 'FIXED_PER_HOUR'::"RateKind" END;
