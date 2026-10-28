CREATE TABLE "shift_templates" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "note" VARCHAR(300) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shift_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shift_templates_valid_times" CHECK (
    "start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND
    "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "start_time" < "end_time"
  )
);
CREATE UNIQUE INDEX "shift_templates_name_key" ON "shift_templates"("name");
