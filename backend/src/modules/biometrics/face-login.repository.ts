import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'

export async function hasFaceLoginTemplate(employeeId: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ enrolled: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM face_embeddings
      WHERE employee_id = ${employeeId}::uuid AND is_active = true
        AND embedding_type = 'CENTROID' AND model_version = ${env.FACE_AUTH_MODEL_VERSION}
        AND embedding IS NOT NULL
    ) AS enrolled;
  `
  return rows[0]?.enrolled === true
}

