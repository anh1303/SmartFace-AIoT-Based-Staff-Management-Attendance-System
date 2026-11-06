import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { assertCanManageEmployee, findEmployeeByIdOrCode } from '../employees/public.js'
import { enqueueOperation, assertNoEnrollment, stagedInput } from '../operations/operation.service.js'
import type { OperationRow } from '../operations/operation.contract.js'
import { currentActor } from '../operations/operation.worker.js'
import { announceDataChange } from '../operations/operation.gateway.js'

export async function submitEnrollment(code: string, images: string[], actor: { id: string; role: string }, key: string) {
  if (env.FACE_AUTH_INTERNAL_KEY.length < 32) throw AppError.conflict('Máy chủ chưa cấu hình FACE_AUTH_INTERNAL_KEY để xử lý khuôn mặt nền.')
  await assertCanManageEmployee(actor, code)
  const emp = await findEmployeeByIdOrCode(code)
  if (!emp || emp.status !== 'ACTIVE') throw AppError.conflict('Chỉ cập nhật khuôn mặt cho nhân viên đang hoạt động.')
  return prisma.$transaction(async tx => {
    const previous = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM background_operations WHERE owner_id = ${actor.id}::uuid AND idempotency_key = ${key}::uuid`
    if (!previous.length) await assertNoEnrollment(tx, emp.id)
    return enqueueOperation(tx, { ownerId: actor.id, key, type: 'biometric.enroll', label: `Cập nhật khuôn mặt ${emp.employee_code}`, payload: { employeeId: emp.id, employeeCode: emp.employee_code }, fingerprint: { employeeId: emp.id, images }, secret: { images } })
  })
}
export async function executeEnrollment(job: OperationRow) {
  const actor = await currentActor(job.owner_id)
  await assertCanManageEmployee(actor, job.payload.employeeId)
  const receipt = await prisma.$queryRaw<{ result: any }[]>`SELECT result FROM face_enrollment_receipts WHERE operation_id = ${job.id}::uuid`
  if (receipt.length) {
    await prisma.$executeRaw`UPDATE background_operations SET status = 'succeeded', completed = 1, succeeded = 1, result = ${JSON.stringify(receipt[0].result)}::jsonb, revision = revision + 1, updated_at = now() WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid`
    return
  }
  const { images } = await stagedInput(job.id)
  let response: Response
  try {
    response = await fetch(`${env.FACE_AUTH_URL}/internal/enroll`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Face-Auth-Key': env.FACE_AUTH_INTERNAL_KEY },
      body: JSON.stringify({ employee_code: job.payload.employeeCode, images_base64: images, operation_id: job.id }), signal: AbortSignal.timeout(env.FACE_AUTH_TIMEOUT_MS) })
  } catch { throw AppError.conflict('Dịch vụ nhận diện mất kết nối hoặc hết thời gian chờ. Hãy kiểm tra kết quả trước khi tải ảnh lại.') }
  if (!response.ok) throw AppError.conflict('Dịch vụ nhận diện chưa lưu được khuôn mặt. Vui lòng kiểm tra ảnh và thử lại.')
  // Python commits the receipt, avatar, audit and job completion together with the vectors.
  const confirmed = await prisma.$queryRaw<{ result: any }[]>`SELECT result FROM face_enrollment_receipts WHERE operation_id = ${job.id}::uuid`
  if (!confirmed.length) throw AppError.conflict('Dịch vụ nhận diện chưa hỗ trợ xác nhận tác vụ nền. Vui lòng cập nhật face_auth.')
  await announceDataChange('biometrics', [job.payload.employeeId], job.owner_id)
}
