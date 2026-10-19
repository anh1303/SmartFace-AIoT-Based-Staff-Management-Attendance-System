BEGIN;
CREATE TYPE "PositionLevel_new" AS ENUM ('MANAGER', 'EMPLOYEE');
ALTER TABLE "positions" ALTER COLUMN "level" DROP DEFAULT;
ALTER TABLE "positions" ALTER COLUMN "level" TYPE "PositionLevel_new" USING (
  CASE 
    WHEN "level"::text = 'MANAGER' THEN 'MANAGER'::"PositionLevel_new"
    ELSE 'EMPLOYEE'::"PositionLevel_new"
  END
);
ALTER TYPE "PositionLevel" RENAME TO "PositionLevel_old";
ALTER TYPE "PositionLevel_new" RENAME TO "PositionLevel";
DROP TYPE "PositionLevel_old";
ALTER TABLE "positions" ALTER COLUMN "level" SET DEFAULT 'EMPLOYEE';
COMMIT;
