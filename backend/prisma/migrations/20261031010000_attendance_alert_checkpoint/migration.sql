CREATE TABLE "attendance_alert_checkpoints" (
  "name" VARCHAR(50) PRIMARY KEY,
  "last_due_at" TIMESTAMPTZ(6) NOT NULL
);
INSERT INTO "attendance_alert_checkpoints" ("name", "last_due_at")
VALUES ('missing_shift_scans', CURRENT_TIMESTAMP);
