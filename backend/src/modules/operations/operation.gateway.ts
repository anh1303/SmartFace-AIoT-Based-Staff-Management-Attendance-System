import type { Server, Socket } from 'socket.io'

let server: Server | undefined
let findEmployee: (id: string) => Promise<{ id: string; departmentId: number | null } | null>
let refreshScope: (socket: Socket) => Promise<void>
export function initializeOperationGateway(io: Server, lookup: typeof findEmployee, security: { authenticate: (socket: Socket, next: (error?: Error) => void) => void; refresh: typeof refreshScope }) {
  server = io
  findEmployee = lookup
  refreshScope = security.refresh
  io.of('/operations').use(security.authenticate)
}
export async function announceOperation(ownerId: string, jobId: string) {
  if (!server) return
  const nsp = server.of('/operations')
  await Promise.all([...nsp.sockets.values()].map(async socket => {
    try { await refreshScope(socket) } catch { socket.disconnect(true) }
  }))
  nsp.to(`user:${ownerId}`).emit('operation.updated', { jobId })
}
export async function announceDataChange(domain: 'employees' | 'shifts' | 'biometrics', employeeIds: string[], ownerId?: string) {
  if (!server || !employeeIds.length) return
  try {
    const nsp = server.of('/operations')
    await Promise.all([...nsp.sockets.values()].map(async socket => {
      try { await refreshScope(socket) } catch { socket.disconnect(true) }
    }))
    const rooms = new Set(['ADMIN'])
    for (const id of new Set(employeeIds)) {
      const employee = await findEmployee(id)
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
