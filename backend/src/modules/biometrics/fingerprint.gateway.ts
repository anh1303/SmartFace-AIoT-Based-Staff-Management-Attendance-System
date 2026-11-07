import type { Server } from 'socket.io'
import { assertCanManageEmployee } from '../employees/public.js'
import { eventBus } from '../../common/event-bus.js'
import { socketAuthMiddleware, refreshSocketScope } from '../../sockets/socket.auth.js'
export function initializeFingerprintGateway(io: Server) {
  const nsp = io.of('/fingerprint')
  nsp.use(socketAuthMiddleware)
  nsp.on('connection', socket => {
    if (!['ADMIN','MANAGER'].includes(socket.data.user?.role?.toUpperCase())) socket.disconnect(true)
  })
  eventBus.subscribe('fingerprint:progress', async ({ owner_id, ...progress }: any) => {
    for (const socket of nsp.sockets.values()) {
      try {
        await refreshSocketScope(socket)
        if (socket.data.user?.id === owner_id && ['ADMIN','MANAGER'].includes(socket.data.user?.role?.toUpperCase())) {
          await assertCanManageEmployee(socket.data.user, progress.employee_id)
          socket.emit('progress', progress)
        }
      } catch { socket.disconnect(true) }
    }
  })
}
