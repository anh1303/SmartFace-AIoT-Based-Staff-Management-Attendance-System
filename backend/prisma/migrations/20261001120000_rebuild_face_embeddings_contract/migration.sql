-- Face data is intentionally recreated from real enrollment images.
-- Preserve employees and all attendance/business records.
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

DELETE FROM "face_embeddings";

DROP INDEX IF EXISTS "idx_face_embeddings_embedding_hnsw";

-- This also repairs imported PBL6.sql dumps where embedding was real[].
ALTER TABLE "face_embeddings"
  ALTER COLUMN "embedding" TYPE vector(512)
  USING NULL::vector(512);
ALTER TABLE "face_embeddings"
  ALTER COLUMN "embedding" SET NOT NULL;
ALTER TABLE "face_embeddings"
  ALTER COLUMN "model_version" DROP DEFAULT;

ALTER TABLE "face_embeddings"
  ADD COLUMN IF NOT EXISTS "embedding_type" VARCHAR(20) NOT NULL DEFAULT 'SAMPLE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.face_embeddings'::regclass
      AND conname = 'face_embeddings_type_check'
  ) THEN
    ALTER TABLE "face_embeddings"
      ADD CONSTRAINT "face_embeddings_type_check"
      CHECK ("embedding_type" IN ('SAMPLE', 'CENTROID'));
  END IF;
END $$;

CREATE UNIQUE INDEX "face_embeddings_one_active_centroid_per_model"
  ON "face_embeddings" ("employee_id", "model_version")
  WHERE "embedding_type" = 'CENTROID' AND "is_active" = true;

CREATE INDEX "idx_face_embeddings_embedding_hnsw"
  ON "face_embeddings" USING hnsw ("embedding" vector_cosine_ops);

COMMIT;
