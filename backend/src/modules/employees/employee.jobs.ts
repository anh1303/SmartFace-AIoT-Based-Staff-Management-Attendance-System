import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { sendAccountCredentialsEmail } from '../../common/email.service.js'
import { stagedInput } from '../operations/operation.service.js'
import { currentActor } from '../operations/operation.worker.js'
import type { OperationRow } from '../operations/operation.contract.js'

export async function executeAccountEmail(job: OperationRow) {
  await currentActor(job.owner_id)
  const input = await stagedInput(job.id)
  const employee = await prisma.employee.findUnique({ where: { id: job.payload.employeeId }, include: { users: true } })
  if (!employee?.users?.is_active || employee.email !== input.to || employee.users.passwordHash !== input.passwordHash) throw AppError.conflict('Tài khoản hoặc mật khẩu đã thay đổi. Không gửi lại thông tin đăng nhập cũ.')
  if (!env.SMTP_USER || !env.SMTP_PASS) throw AppError.conflict('Chưa gửi được email: máy chủ chưa cấu hình SMTP. Nhân viên đã được tạo; quản trị viên có thể đặt lại mật khẩu.')
  const result = await sendAccountCredentialsEmail(input)
  if (!result.success || result.simulated) throw AppError.conflict('Chưa gửi được email tài khoản. Nhân viên đã được tạo; vui lòng kiểm tra SMTP hoặc đặt lại mật khẩu.')
  await prisma.$executeRaw`UPDATE background_operations SET status = 'succeeded', total = 1, completed = 1, succeeded = 1, revision = revision + 1, updated_at = now() WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid AND status = 'running'`
}
