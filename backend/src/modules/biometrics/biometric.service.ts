import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'

async function resolveEmployeeId(idOrCode: string) {
  const emp = await prisma.employee.findFirst({
    where: { OR: [{ id: idOrCode }, { employee_code: idOrCode }] },
  })
  if (!emp) throw new AppError(404, 'Employee not found')
  return emp.id
}

export async function getByEmployee(idOrCode: string) {
  const employeeId = await resolveEmployeeId(idOrCode)
  const embeddings = await prisma.face_embeddings.findMany({
    where: { employee_id: employeeId, is_active: true },
    select: {
      id: true,
      employee_id: true,
      model_version: true,
      sample_tag: true,
      quality_score: true,
      is_active: true,
      created_at: true,
    },
    orderBy: { created_at: 'desc' },
  })

  return { employeeId, sampleCount: embeddings.length, samples: embeddings }
}

export async function register(
  idOrCode: string,
  embedding: number[],
  options?: { model_version?: string; sample_tag?: string; quality_score?: number },
  actorUserId?: string,
) {
  const employeeId = await resolveEmployeeId(idOrCode)
  const vectorStr = `[${embedding.join(',')}]`

  const rows = await prisma.$queryRaw<Array<{
    id: string
    employee_id: string
    model_version: string
    sample_tag: string | null
    quality_score: number | null
    is_active: boolean
    created_at: Date
  }>>`
    INSERT INTO "face_embeddings" (
      "id", "employee_id", "embedding", "model_version", "sample_tag", "quality_score", "is_active", "created_at"
    )
    VALUES (
      gen_random_uuid(),
      ${employeeId}::uuid,
      ${vectorStr}::vector,
      ${options?.model_version ?? 'arcface_v1'},
      ${options?.sample_tag ?? 'FRONTAL'},
      ${options?.quality_score ?? null},
      true,
      CURRENT_TIMESTAMP
    )
    RETURNING "id", "employee_id", "model_version", "sample_tag", "quality_score", "is_active", "created_at"
  `

  await logAction({
    userId: actorUserId,
    action: 'REGISTER_BIOMETRIC',
    target_table: 'face_embeddings',
    record_id: rows[0].id,
    new_values: {
      employee_id: employeeId,
      model_version: rows[0].model_version,
      sample_tag: rows[0].sample_tag,
      quality_score: rows[0].quality_score,
    },
  })

  return rows[0]
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