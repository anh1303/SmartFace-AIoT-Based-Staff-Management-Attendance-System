import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'
import { env } from '../../config/env.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveEmployeeId(idOrCode: string) {
  const isUuid = UUID_REGEX.test(idOrCode)
  const emp = await prisma.employee.findFirst({
    where: isUuid ? { OR: [{ id: idOrCode }, { employee_code: idOrCode }] } : { employee_code: idOrCode },
  })
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

  return { employeeId, sampleCount: embeddings.length, samples: embeddings }
}

export async function deactivate(idOrCode: string) {
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
  const employeeId = await resolveEmployeeId(idOrCode)
  const emp = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { employee_code: true },
  })
  if (!emp) throw new AppError(404, 'Employee not found')

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

  return {
    ...result,
    total_images,
    detected_faces,
    extraction_rate,
    employee_id: employeeId,
  }
}
