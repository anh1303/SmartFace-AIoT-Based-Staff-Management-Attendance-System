import type { Prisma } from '@prisma/client'
import { AppError } from '../../common/AppError.js'
import { isEmployeeManager, findEmployeeWithRelations } from '../employees/public.js'
import { findActiveAdminUserIds, findActiveManagerUserIdsByDepartment } from '../auth/public.js'

export async function assertAggregationHealthy(tx: Prisma.TransactionClient, period: string) {
  const state = await tx.attendanceAggregationState.findUnique({ where: { period } })
  if (state?.failed) throw AppError.conflict(`Tổng hợp chấm công kỳ ${period} đang lỗi; cần xử lý và chạy lại trước khi khóa hoặc chốt`)
}

export async function notifyLockedScan(tx: Prisma.TransactionClient, employeeId: string, logId: bigint, type: string, eventTime: Date, receivedAt: Date) {
  const txAny = tx as any
  if (!txAny.systemNotification?.createMany) return
  const employee = await findEmployeeWithRelations(employeeId, tx)
  if (!employee) return
  const adminIds = await findActiveAdminUserIds(tx).catch(() => [])
  const managerIds = employee.departmentId && !isEmployeeManager(employee)
    ? await findActiveManagerUserIdsByDepartment(employee.departmentId, employee.id, tx).catch(() => [])
    : []
  const time = (value: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(value)
  const label = type === 'CHECK_IN' ? 'check-in' : 'check-out'
  const details = `${label} lúc ${time(eventTime)}; hệ thống nhận lúc ${time(receivedAt)}`
  const recipients = new Map<string, string>()
  for (const userId of [...adminIds, ...managerIds]) recipients.set(userId, `${employee.full_name}: ${details}. Ngày công đã khóa, lượt này chưa được tính.`)
  if (employee.user_id) recipients.set(employee.user_id, `Hệ thống đã nhận lượt ${details}, nhưng lượt này chưa được tính vào công đã chốt. Vui lòng liên hệ quản lý.`)
  if (recipients.size > 0 && tx.systemNotification?.createMany) {
    await tx.systemNotification.createMany({ data: [...recipients].map(([user_id, message]) => ({ user_id, employee_id: employeeId, event_key: `locked-scan:${logId}`, title: 'Lượt chấm công sau khi khóa', message })), skipDuplicates: true })
  }
}
