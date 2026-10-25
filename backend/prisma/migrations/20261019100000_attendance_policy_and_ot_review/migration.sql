-- Additive only: no business records, wages or historical totals are deleted/reset.
ALTER TABLE attendance_logs ADD COLUMN event_key VARCHAR(180), ADD COLUMN work_date DATE;
CREATE UNIQUE INDEX attendance_logs_event_key_key ON attendance_logs(event_key);
CREATE INDEX attendance_logs_emp_work_date ON attendance_logs(employee_id, work_date);
ALTER TABLE daily_attendance_summary
  ADD COLUMN regular_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN overtime_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN late_early_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN overtime_candidate_hours DECIMAL(7,2) NOT NULL DEFAULT 0,
  ADD COLUMN overtime_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  ADD COLUMN overtime_reason TEXT,
  ADD COLUMN approved_by VARCHAR(100),
  ADD COLUMN approved_at TIMESTAMPTZ(6),
  ADD COLUMN requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN review_reason TEXT,
  ADD COLUMN manual_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN calculation_details JSONB,
  ADD COLUMN policy_version VARCHAR(40);
ALTER TABLE payroll_records
  ADD COLUMN overtime_rate DECIMAL(15,4),
  ADD COLUMN late_penalty_rate DECIMAL(15,4),
  ADD COLUMN calculation_details JSONB;
