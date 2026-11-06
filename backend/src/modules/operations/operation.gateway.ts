import type { Server } from 'socket.io'
import { socketAuthMiddleware, refreshSocketScope } from '../../sockets/socket.auth.js'
import { findEmployeeByIdOrCode } from '../employees/public.js'

let server: Server | undefined
export function initializeOperationGateway(io: Server) {
  server = io
  io.of('/operations').use(socketAuthMiddleware)
}
export async function announceOperation(ownerId: string, jobId: string) {
  if (!server) return
  const nsp = server.of('/operations')
  await Promise.all([...nsp.sockets.values()].map(async socket => {
    try { await refreshSocketScope(socket) } catch { socket.disconnect(true) }
  }))
  nsp.to(`user:${ownerId}`).emit('operation.updated', { jobId })
}
export async function announceDataChange(domain: 'employees' | 'shifts' | 'biometrics', employeeIds: string[], ownerId?: string) {
  if (!server || !employeeIds.length) return
  try {
    const nsp = server.of('/operations')
    await Promise.all([...nsp.sockets.values()].map(async socket => {
      try { await refreshSocketScope(socket) } catch { socket.disconnect(true) }
    }))
    const rooms = new Set(['ADMIN'])
    for (const id of new Set(employeeIds)) {
      const employee = await findEmployeeByIdOrCode(id)
      if (!employee) continue
      rooms.add(`employee:${employee.id}`)
      if (employee.departmentId) rooms.add(`department:${employee.departmentId}`)
    }
    const message = domain === 'shifts' ? 'Lịch làm việc vừa được cập nhật. Đang tải dữ liệu mới.' : domain === 'biometrics' ? 'Dữ liệu khuôn mặt vừa được cập nhật. Đang tải trạng thái mới.' : 'Thông tin nhân viên vừa được cập nhật. Đang tải dữ liệu mới.'
    let recipients = nsp.to([...rooms])
    if (ownerId) recipients = recipients.except(`user:${ownerId}`)
    recipients.emit('data.changed', { domain, message })
  } catch { /* Socket delivery cannot turn a committed write into an API failure; polling remains authoritative. */ }
}
