-- Existing Prisma Employee reads require this column, but older migrations omitted it.
-- IF NOT EXISTS also supports cloud databases where it was previously added manually.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "fingerprint_enrolled" BOOLEAN NOT NULL DEFAULT false;
