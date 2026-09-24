import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { BIOMETRIC_DEFAULTS } from '../../common/constants.js'

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
) {
  const employeeId = await resolveEmployeeId(idOrCode)

  const record = await prisma.face_embeddings.create({
    data: {
      employee_id: employeeId,
      embedding,
      model_version: options?.model_version ?? BIOMETRIC_DEFAULTS.MODEL_VERSION,
      sample_tag: options?.sample_tag ?? BIOMETRIC_DEFAULTS.SAMPLE_TAG,
      quality_score: options?.quality_score ?? null,
      is_active: true,
    },
  })

  const { embedding: _emb, ...safeRecord } = record
  return safeRecord
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

export async function removeAll(idOrCode: string) {
  const employeeId = await resolveEmployeeId(idOrCode)
  const count = await prisma.face_embeddings.count({ where: { employee_id: employeeId } })
  if (count === 0) throw new AppError(404, 'No biometric data found for this employee')
  await prisma.face_embeddings.deleteMany({ where: { employee_id: employeeId } })
}
