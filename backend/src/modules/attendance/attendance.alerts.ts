import type { Prisma } from '@prisma/client'
import { AppError } from '../../common/AppError.js'
import { isEmployeeManager } from '../employees/employee.permission.js'

export async function assertAggregationHealthy(tx: Prisma.TransactionClient, period: string) {
  const state = await tx.attendanceAggregationState.findUnique({ where: { period } })
  if (state?.failed) throw AppError.conflict(`Tổng hợp chấm công kỳ ${period} đang lỗi; cần xử lý và chạy lại trước khi khóa hoặc chốt`)
}

export async function notifyLockedScan(tx: Prisma.TransactionClient, employeeId: string, logId: bigint, type: string, eventTime: Date, receivedAt: Date) {
  const employee = await tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: { position: true, department: true, users: { include: { roles: true } } } })
  const admins = await tx.user.findMany({ where: { is_active: true, roles: { role_name: 'ADMIN' } }, select: { id: true } })
  const managers = employee.departmentId && !isEmployeeManager(employee) ? await tx.user.findMany({
    where: { is_active: true, roles: { role_name: 'MANAGER' }, employees: { departmentId: employee.departmentId, status: 'ACTIVE', id: { not: employee.id } } }, select: { id: true },
  }) : []
  const time = (value: Date) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(value)
  const label = type === 'CHECK_IN' ? 'check-in' : 'check-out'
  const details = `${label} lúc ${time(eventTime)}; hệ thống nhận lúc ${time(receivedAt)}`
  const recipients = new Map<string, string>()
  for (const user of [...admins, ...managers]) recipients.set(user.id, `${employee.full_name}: ${details}. Ngày công đã khóa, lượt này chưa được tính.`)
  if (employee.user_id) recipients.set(employee.user_id, `Hệ thống đã nhận lượt ${details}, nhưng lượt này chưa được tính vào công đã chốt. Vui lòng liên hệ quản lý.`)
  await tx.systemNotification.createMany({ data: [...recipients].map(([user_id, message]) => ({ user_id, employee_id: employeeId, event_key: `locked-scan:${logId}`, title: 'Lượt chấm công sau khi khóa', message })), skipDuplicates: true })
}
