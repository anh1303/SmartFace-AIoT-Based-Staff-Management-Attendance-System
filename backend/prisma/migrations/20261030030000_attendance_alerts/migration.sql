CREATE TABLE "attendance_aggregation_state" (
  "period" VARCHAR(7) PRIMARY KEY,
  "failed" BOOLEAN NOT NULL DEFAULT false,
  "run_id" UUID,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "system_notifications" (
  "id" BIGSERIAL PRIMARY KEY,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "employee_id" UUID REFERENCES "employees"("id") ON DELETE CASCADE,
  "event_key" VARCHAR(120) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "read_at" TIMESTAMPTZ(6),
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "system_notifications_user_id_event_key_key" UNIQUE ("user_id", "event_key")
);
CREATE INDEX "system_notifications_user_id_created_at_idx" ON "system_notifications" ("user_id", "created_at" DESC);
