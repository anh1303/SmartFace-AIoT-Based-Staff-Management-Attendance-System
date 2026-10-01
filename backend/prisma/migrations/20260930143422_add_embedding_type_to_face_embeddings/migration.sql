-- AlterTable
ALTER TABLE "face_embeddings" ADD COLUMN     "embedding_type" VARCHAR(20) NOT NULL DEFAULT 'SAMPLE';

-- CreateIndex
CREATE INDEX "idx_face_embeddings_type" ON "face_embeddings"("embedding_type");

-- CheckConstraint
ALTER TABLE face_embeddings 
ADD CONSTRAINT face_embeddings_type_check 
CHECK (embedding_type IN ('SAMPLE', 'CENTROID'));
