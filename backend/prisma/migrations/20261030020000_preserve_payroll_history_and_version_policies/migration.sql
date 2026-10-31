BEGIN;
LOCK TABLE payroll_records, bonus_penalty IN ACCESS EXCLUSIVE MODE;

-- The preceding migration may already have dropped the units. Do not infer them
-- from numeric magnitude or overwrite saved salary/rate columns.
CREATE TABLE payroll_rate_repair_archive (
  payroll_id bigint PRIMARY KEY,
  original_record jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO payroll_rate_repair_archive (payroll_id, original_record)
SELECT id, to_jsonb(p) FROM payroll_records p;

UPDATE payroll_records SET calculation_details =
  (CASE WHEN jsonb_typeof(calculation_details) = 'object' THEN calculation_details ELSE '{}'::jsonb END) || jsonb_build_object(
    'rate_snapshot_status', 'UNRESOLVED',
    'rate_repair_reason', 'Rate units were removed; verify against backup before using historical snapshots'
  );

-- Widen without losing historical values; old unversioned rows are retained.
ALTER TABLE bonus_penalty
  ALTER COLUMN overtime_rate TYPE numeric(15,4),
  ALTER COLUMN late_early_penalty TYPE numeric(15,4),
  ALTER COLUMN absence_penalty_rate TYPE numeric(15,4),
  ADD COLUMN effective_period varchar(7);
CREATE UNIQUE INDEX bonus_penalty_effective_period_key ON bonus_penalty(effective_period);
ALTER TABLE bonus_penalty ADD CONSTRAINT bonus_penalty_versioned_rates_check CHECK (
  effective_period IS NULL OR (
    effective_period ~ '^(20[0-9]{2}|2100)-(0[1-9]|1[0-2])$'
    AND overtime_rate BETWEEN 0 AND 50
    AND late_early_penalty BETWEEN 0 AND 50
    AND absence_penalty_rate BETWEEN 0 AND 50
  )
);

-- Only the deployment month has a known multiplier baseline. Earlier months
-- require a verified policy import, never a backdated guess.
INSERT INTO bonus_penalty (overtime_rate, late_early_penalty, absence_penalty_rate, description, effective_period, updated_at)
SELECT
  CASE WHEN overtime_rate BETWEEN 0 AND 50 THEN overtime_rate ELSE 2 END,
  CASE WHEN late_early_penalty BETWEEN 0 AND 50 THEN late_early_penalty ELSE 1.5 END,
  CASE WHEN absence_penalty_rate BETWEEN 0 AND 50 THEN absence_penalty_rate ELSE 2 END,
  'Multiplier baseline; historical policies require verification',
  to_char(now() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM'), now()
FROM bonus_penalty ORDER BY id DESC LIMIT 1;

-- Enforce append-only versions, including writes outside the API.
CREATE FUNCTION protect_effective_payroll_policy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.effective_period IS NOT NULL THEN
    RAISE EXCEPTION 'Effective payroll policy versions are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER bonus_penalty_immutable_version BEFORE UPDATE OR DELETE ON bonus_penalty
FOR EACH ROW EXECUTE FUNCTION protect_effective_payroll_policy();

COMMIT;
