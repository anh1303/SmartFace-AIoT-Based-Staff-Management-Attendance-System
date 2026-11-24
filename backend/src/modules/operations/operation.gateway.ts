import type { Server, Socket } from 'socket.io'
import { enqueueNamespaceTask } from '../../sockets/socket.auth.js'

let server: Server | undefined
let findEmployeesMeta: (ids: readonly string[]) => Promise<ReadonlyArray<{ id: string; departmentId: number | null }>>
let refreshNamespace: (sockets: Iterable<Socket>) => Promise<void>

export function initializeOperationGateway(
  io: Server,
  lookupBatch: typeof findEmployeesMeta,
  security: {
    authenticate: (socket: Socket, next: (error?: Error) => void) => void
    refreshNamespace: (sockets: Iterable<Socket>) => Promise<void>
  },
) {
  server = io
  findEmployeesMeta = lookupBatch
  refreshNamespace = security.refreshNamespace
  io.of('/operations').use(security.authenticate)
}

async function emitDataChangeToNamespace(
  nsp: ReturnType<Server['of']>,
  domain: 'employees' | 'shifts' | 'biometrics',
  employeeIds: string[],
  ownerId?: string,
) {
  const rooms = new Set(['ADMIN'])
  const uniqueIds = [...new Set(employeeIds.filter(Boolean))]
  const employees = uniqueIds.length > 0 ? await findEmployeesMeta(uniqueIds) : []
  for (const employee of employees) {
    if (!employee) continue
    rooms.add(`employee:${employee.id}`)
    if (employee.departmentId) rooms.add(`department:${employee.departmentId}`)
  }
  const message = domain === 'shifts'
    ? 'Lịch làm việc vừa được cập nhật. Đang tải dữ liệu mới.'
    : domain === 'biometrics'
      ? 'Dữ liệu khuôn mặt vừa được cập nhật. Đang tải trạng thái mới.'
      : 'Thông tin nhân viên vừa được cập nhật. Đang tải dữ liệu mới.'
  let recipients = nsp.to([...rooms])
  if (ownerId) recipients = recipients.except(`user:${ownerId}`)
  recipients.emit('data.changed', { domain, message })
}

export async function announceOperation(
  ownerId: string,
  jobId: string,
  dataChange?: { domain: 'employees' | 'shifts' | 'biometrics'; employeeIds: string[] },
) {
  if (!server) return
  const nsp = server.of('/operations')
  if (nsp.sockets.size === 0) return

  await enqueueNamespaceTask(nsp, async () => {
    if (nsp.sockets.size === 0) return
    try {
      await refreshNamespace(nsp.sockets.values())
      if (nsp.sockets.size === 0) return

      if (dataChange && dataChange.employeeIds.length > 0) {
        try {
          await emitDataChangeToNamespace(nsp, dataChange.domain, dataChange.employeeIds, ownerId)
        } catch {
          /* Employee lookup failure must not block operation.updated delivery to the owner. */
        }
      }
      nsp.to(`user:${ownerId}`).emit('operation.updated', { jobId })
    } catch {
      /* Socket auth/DB failure stops this turn without emitting stale scopes; polling remains authoritative. */
    }
  })
}

export async function announceDataChange(
  domain: 'employees' | 'shifts' | 'biometrics',
  employeeIds: string[],
  ownerId?: string,
) {
  if (!server || !employeeIds.length) return
  const nsp = server.of('/operations')
  if (nsp.sockets.size === 0) return

  await enqueueNamespaceTask(nsp, async () => {
    if (nsp.sockets.size === 0) return
    try {
      await refreshNamespace(nsp.sockets.values())
      if (nsp.sockets.size === 0) return
      await emitDataChangeToNamespace(nsp, domain, employeeIds, ownerId)
    } catch {
      /* Socket delivery cannot turn a committed write into an API failure; polling remains authoritative. */
    }
  })
}
