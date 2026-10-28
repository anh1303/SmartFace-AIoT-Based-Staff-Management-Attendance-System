ALTER TABLE "users" ADD COLUMN "profile" JSONB;
CREATE TABLE "solution_inquiries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "company" VARCHAR(150) NOT NULL,
  "plan" VARCHAR(20),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "solution_inquiries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "solution_inquiries_created_at_idx" ON "solution_inquiries"("created_at");
