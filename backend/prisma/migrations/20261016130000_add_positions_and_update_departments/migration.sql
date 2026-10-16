-- 1. Create Enum PositionLevel
DO $$ BEGIN
    CREATE TYPE "PositionLevel" AS ENUM ('MANAGER', 'LEADER', 'STAFF');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter Table departments
ALTER TABLE "departments" 
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3. Create Table positions
CREATE TABLE IF NOT EXISTS "positions" (
    "id" SERIAL NOT NULL,
    "position_code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "level" "PositionLevel" NOT NULL DEFAULT 'STAFF',
    "department_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- 4. Create unique index and department index on positions
CREATE UNIQUE INDEX IF NOT EXISTS "positions_position_code_key" ON "positions"("position_code");
CREATE INDEX IF NOT EXISTS "idx_positions_dept" ON "positions"("department_id");

-- 5. Add foreign key from positions to departments
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'positions_department_id_fkey'
  ) THEN
    ALTER TABLE "positions" 
      ADD CONSTRAINT "positions_department_id_fkey" 
      FOREIGN KEY ("department_id") REFERENCES "departments"("id") 
      ON DELETE RESTRICT ON UPDATE NO ACTION;
  END IF;
END $$;

-- 6. Add position_id to employees
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "position_id" INTEGER;

-- 7. Data Migration: Auto-create positions from existing employees.position and link them
DO $$
DECLARE
  rec RECORD;
  new_pos_id INTEGER;
  pos_code VARCHAR(50);
  calc_level "PositionLevel";
  d_id INTEGER;
  first_dept_id INTEGER;
BEGIN
  SELECT "id" INTO first_dept_id FROM "departments" ORDER BY "id" ASC LIMIT 1;

  FOR rec IN 
    SELECT DISTINCT TRIM("position") AS pos_name, "department_id" 
    FROM "employees" 
    WHERE "position" IS NOT NULL AND TRIM("position") <> ''
  LOOP
    d_id := COALESCE(rec.department_id, first_dept_id);
    
    IF rec.pos_name ILIKE '%quản lý%' OR rec.pos_name ILIKE '%trưởng phòng%' OR rec.pos_name ILIKE '%giám đốc%' OR rec.pos_name ILIKE '%manager%' THEN
      calc_level := 'MANAGER'::"PositionLevel";
    ELSIF rec.pos_name ILIKE '%trưởng nhóm%' OR rec.pos_name ILIKE '%leader%' OR rec.pos_name ILIKE '%chính%' THEN
      calc_level := 'LEADER'::"PositionLevel";
    ELSE
      calc_level := 'STAFF'::"PositionLevel";
    END IF;

    SELECT "id" INTO new_pos_id 
    FROM "positions" 
    WHERE "department_id" = d_id AND LOWER("name") = LOWER(rec.pos_name)
    LIMIT 1;

    IF new_pos_id IS NULL THEN
      pos_code := 'POS_' || UPPER(SUBSTRING(MD5(d_id || '_' || rec.pos_name) FROM 1 FOR 8));
      
      WHILE EXISTS (SELECT 1 FROM "positions" WHERE "position_code" = pos_code) LOOP
        pos_code := 'POS_' || UPPER(SUBSTRING(MD5(RANDOM()::text) FROM 1 FOR 8));
      END LOOP;

      INSERT INTO "positions" ("position_code", "name", "level", "department_id", "is_active")
      VALUES (pos_code, rec.pos_name, calc_level, d_id, true)
      RETURNING "id" INTO new_pos_id;
    END IF;

    UPDATE "employees"
    SET "position_id" = new_pos_id
    WHERE TRIM("position") = rec.pos_name
      AND ("department_id" = rec.department_id OR (rec.department_id IS NULL AND "department_id" IS NULL));
  END LOOP;
END $$;

-- 8. Xóa cột position cũ từ employees theo yêu cầu
ALTER TABLE "employees" DROP COLUMN IF EXISTS "position";

-- 9. Tạo index và foreign key trên employees.position_id
CREATE INDEX IF NOT EXISTS "employees_position_id_idx" ON "employees"("position_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employees_position_id_fkey'
  ) THEN
    ALTER TABLE "employees" 
      ADD CONSTRAINT "employees_position_id_fkey" 
      FOREIGN KEY ("position_id") REFERENCES "positions"("id") 
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;
