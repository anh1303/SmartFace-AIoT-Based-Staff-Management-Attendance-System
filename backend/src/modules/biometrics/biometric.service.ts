import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/public.js'
import { env } from '../../config/env.js'
import { findEmployeeByIdOrCode, findActiveEmployeeIds, assertCanManageEmployee, type EmployeeActor } from '../employees/public.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveEmployeeId(idOrCode: string) {
  const emp = await findEmployeeByIdOrCode(idOrCode)
  if (!emp) throw new AppError(404, 'Employee not found')
  return emp.id
}

export async function getByEmployee(idOrCode: string) {
  const employeeId = await resolveEmployeeId(idOrCode)
  const embeddings = await prisma.face_embeddings.findMany({
    where: {
      employee_id: employeeId,
      is_active: true,
      model_version: env.FACE_AUTH_MODEL_VERSION,
    },
    select: {
      id: true,
      employee_id: true,
      model_version: true,
      embedding_type: true,
      sample_tag: true,
      quality_score: true,
      is_active: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  })

  invalidateCentroidCache()

  return { employeeId, sampleCount: embeddings.length, samples: embeddings }
}

export async function deactivate(idOrCode: string, actor?: EmployeeActor) {
  await assertCanManageEmployee(actor, idOrCode)
  const employeeId = await resolveEmployeeId(idOrCode)
  const count = await prisma.face_embeddings.count({
    where: { employee_id: employeeId, is_active: true },
  })
  if (count === 0) throw new AppError(404, 'No active biometric data found for this employee')

  await prisma.face_embeddings.updateMany({
    where: { employee_id: employeeId },
    data: { is_active: false },
  })
}

export async function removeAll(idOrCode: string, actorUserId?: string) {
  const employeeId = await resolveEmployeeId(idOrCode)
  const count = await prisma.face_embeddings.count({ where: { employee_id: employeeId } })
  if (count === 0) throw new AppError(404, 'No biometric data found for this employee')
  await prisma.face_embeddings.deleteMany({ where: { employee_id: employeeId } })
  invalidateCentroidCache()

  await logAction({
    userId: actorUserId,
    action: 'DELETE_BIOMETRIC',
    target_table: 'face_embeddings',
    record_id: employeeId,
    old_values: {
      employee_id: employeeId,
      deleted_samples_count: count,
    },
  })
}

export async function enrollImages(idOrCode: string, imagesBase64: string[], actorUserId?: string) {
  const emp = await findEmployeeByIdOrCode(idOrCode)
  if (!emp) throw new AppError(404, 'Employee not found')
  const employeeId = emp.id

  const timeoutMs = env.FACE_AUTH_TIMEOUT_MS || 30000
  let resp: globalThis.Response
  try {
    resp = await fetch(`${env.FACE_AUTH_URL}/internal/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employee_code: emp.employee_code,
        images_base64: imagesBase64,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new AppError(504, 'face_auth không phản hồi: Timeout')
    }
    throw new AppError(503, `face_auth không phản hồi: ${err.message}`)
  }

  if (!resp.ok) {
    let errMsg = 'Face enrollment failed'
    try {
      const errBody = (await resp.json()) as any
      errMsg = errBody.detail || errBody.message || errMsg
    } catch {
      // ignore
    }
    throw new AppError(resp.status, errMsg)
  }

  const result = (await resp.json()) as {
    status: string
    employee_code: string
    total_images?: number
    detected_faces?: number
    n_samples_used: number
    n_outliers_removed: number
    extraction_rate?: number
    valid_rate?: number
    message?: string
    warnings: string[]
  }

  const total_images = result.total_images ?? imagesBase64.length
  const detected_faces = result.detected_faces ?? result.n_samples_used
  const extraction_rate = result.extraction_rate ?? (total_images > 0 ? Math.round((detected_faces / total_images) * 1000) / 10 : 0)

  await logAction({
    userId: actorUserId,
    action: 'ENROLL_FACE_IMAGES',
    target_table: 'face_embeddings',
    record_id: employeeId,
    new_values: {
      employee_id: employeeId,
      employee_code: emp.employee_code,
      total_images,
      detected_faces,
      n_samples_used: result.n_samples_used,
      n_outliers_removed: result.n_outliers_removed,
      extraction_rate,
      warnings: result.warnings,
    },
  })

  invalidateCentroidCache()

  return {
    ...result,
    total_images,
    detected_faces,
    extraction_rate,
    employee_id: employeeId,
  }
}

export async function enrollImagesWithPermissionCheck(
  employeeId: string,
  imagesBase64: string[],
  actorUser?: { id?: string; role?: string }
) {
  await assertCanManageEmployee(actorUser, employeeId)

  return enrollImages(employeeId, imagesBase64, actorUser?.id);
}

export async function removeAllWithPermissionCheck(
  employeeId: string,
  actorUser?: { id?: string; role?: string }
) {
  await assertCanManageEmployee(actorUser, employeeId)

  return removeAll(employeeId, actorUser?.id);
}

export type FaceMatchCandidate = {
  emp_id: string
  employee_code: string
  full_name: string
  avatar_url: string | null
  embedding_type: string
  similarity: number
}

interface CachedCentroid {
  emp_id: string
  employee_code: string
  full_name: string
  avatar_url: string | null
  embedding_type: string
  vec: Float32Array
}

let centroidCache: CachedCentroid[] | null = null
let centroidCacheTime = 0
const CENTROID_CACHE_TTL_MS = 60_000 // 60s auto refresh

export function invalidateCentroidCache() {
  centroidCache = null
  centroidCacheTime = 0
}

async function getCachedCentroids(client: Prisma.TransactionClient | typeof prisma): Promise<CachedCentroid[]> {
  const now = Date.now()
  if (centroidCache && now - centroidCacheTime < CENTROID_CACHE_TTL_MS) {
    return centroidCache
  }

  const rows: Array<{
    emp_id: string
    employee_code: string
    full_name: string
    avatar_url: string | null
    embedding_type: string
    embedding_text: string
  }> = await client.$queryRaw`
    SELECT
      e.id AS emp_id,
      e.employee_code,
      e.full_name,
      e.avatar_url,
      f.embedding_type,
      f.embedding::text AS embedding_text
    FROM face_embeddings f
    JOIN employees e ON f.employee_id = e.id
    WHERE f.is_active = true
      AND f.embedding IS NOT NULL
      AND f.model_version = ${env.FACE_AUTH_MODEL_VERSION}
      AND f.embedding_type = 'CENTROID'
      AND e.status = 'ACTIVE';
  `

  centroidCache = rows.map((r) => ({
    emp_id: r.emp_id,
    employee_code: r.employee_code,
    full_name: r.full_name,
    avatar_url: r.avatar_url,
    embedding_type: r.embedding_type,
    vec: new Float32Array(JSON.parse(r.embedding_text)),
  }))
  centroidCacheTime = now
  return centroidCache
}

/**
 * Public Contract: Tìm nhân viên khớp với khuôn mặt gần nhất thông qua pgvector / In-Memory RAM Cache (siêu tốc < 1ms)
 */
export async function findBestFaceMatch(
  vecLiteral: string,
  tx?: Prisma.TransactionClient
): Promise<FaceMatchCandidate | null> {
  const client = tx ?? prisma
  try {
    const cached = await getCachedCentroids(client)
    if (!cached || cached.length === 0) return null

    const inputVec = new Float32Array(JSON.parse(vecLiteral))
    let best: CachedCentroid | null = null
    let bestSim = -1

    for (const c of cached) {
      let dot = 0
      for (let i = 0; i < 512; i++) {
        dot += inputVec[i] * c.vec[i]
      }
      if (dot > bestSim) {
        bestSim = dot
        best = c
      }
    }

    if (!best || bestSim < 0) return null

    return {
      emp_id: best.emp_id,
      employee_code: best.employee_code,
      full_name: best.full_name,
      avatar_url: best.avatar_url ?? null,
      embedding_type: best.embedding_type,
      similarity: Number(bestSim.toFixed(4)),
    }
  } catch {
    // Fallback nếu parse vector hoặc cache lỗi: truy vấn trực tiếp DB
    const currentModelVersion = env.FACE_AUTH_MODEL_VERSION
    const activeEmployeeIds = await findActiveEmployeeIds(tx)
    if (!activeEmployeeIds || activeEmployeeIds.length === 0) return null

    const rows: Array<{
      employee_id: string
      embedding_type: string
      similarity: number
    }> = await client.$queryRaw`
      SELECT
        f.employee_id,
        f.embedding_type,
        (1 - (f.embedding <=> ${vecLiteral}::vector))::float AS similarity
      FROM face_embeddings f
      WHERE f.is_active = true
        AND f.embedding IS NOT NULL
        AND f.model_version = ${currentModelVersion}
        AND f.embedding_type = 'CENTROID'
        AND f.employee_id = ANY(${activeEmployeeIds}::uuid[])
      ORDER BY f.embedding <=> ${vecLiteral}::vector ASC
      LIMIT 1;
    `
    if (!rows || rows.length === 0) return null
    const bestRow = rows[0]
    const emp = await findEmployeeByIdOrCode(bestRow.employee_id, tx)
    if (!emp || emp.status !== 'ACTIVE') return null
    return {
      emp_id: emp.id,
      employee_code: emp.employee_code,
      full_name: emp.full_name,
      avatar_url: emp.avatar_url ?? null,
      embedding_type: bestRow.embedding_type,
      similarity: bestRow.similarity,
    }
  }
}

/**
 * Public Contract: Xóa dữ liệu sinh trắc học khi xóa nhân viên (hỗ trợ transaction)
 */
export async function deleteBiometricsForEmployee(
  employeeId: string,
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma
  invalidateCentroidCache()
  return client.face_embeddings.deleteMany({
    where: { employee_id: employeeId },
  })
}

