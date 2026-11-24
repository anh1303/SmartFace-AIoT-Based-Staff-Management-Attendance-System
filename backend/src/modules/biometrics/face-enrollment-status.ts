import type { Prisma } from '@prisma/client'
import { env } from '../../config/env.js'

export const faceEnrollmentSummarySelect = {
  where: {
    is_active: true,
    embedding_type: 'CENTROID',
    model_version: env.FACE_AUTH_MODEL_VERSION,
  },
  select: {
    id: true,
    model_version: true,
    sample_tag: true,
    quality_score: true,
    created_at: true,
  },
} as const satisfies Prisma.Employee$face_embeddingsArgs

export function hasActiveFaceEnrollment(samples: readonly unknown[] | null | undefined): boolean {
  return Array.isArray(samples) && samples.length > 0
}
