import { expect, it, vi } from 'vitest'
vi.mock('../../src/sockets/socket.auth.js', () => ({ socketAuthMiddleware: vi.fn(), refreshSocketScope: vi.fn() }))
import { announceDataChange, initializeOperationGateway } from '../../src/modules/operations/operation.gateway.js'
import { currentActor, setOperationActorLookup } from '../../src/modules/operations/operation.worker.js'

it('uses the employee resolver provided by composition to address data change events', async () => {
  const emit = vi.fn()
  const to = vi.fn(() => ({ except: vi.fn(() => ({ emit })), emit }))
  const namespace = { use: vi.fn(), sockets: new Map(), to }
  const io = { of: vi.fn(() => namespace) }
  const lookup = vi.fn(async () => ({ id: 'employee-1', departmentId: 7 }))
  initializeOperationGateway(io as any, lookup, { authenticate: vi.fn(), refresh: vi.fn() })
  await announceDataChange('employees', ['NV1'], 'owner')
  expect(lookup).toHaveBeenCalledWith('NV1')
  expect(to).toHaveBeenCalledWith(['ADMIN', 'employee:employee-1', 'department:7'])
  expect(emit).toHaveBeenCalledWith('data.changed', expect.objectContaining({ domain: 'employees' }))
})

it('uses the configured identity lookup and rejects a disabled account', async () => {
  setOperationActorLookup(async () => ({ id: 'owner', is_active: true, roles: { role_name: 'MANAGER' } }))
  await expect(currentActor('owner')).resolves.toEqual({ id: 'owner', role: 'MANAGER' })
  setOperationActorLookup(async () => ({ id: 'owner', is_active: false, roles: { role_name: 'MANAGER' } }))
  await expect(currentActor('owner')).rejects.toMatchObject({ statusCode: 403 })
})

it('disconnects a socket whose scope can no longer be refreshed', async () => {
  const socket = { disconnect: vi.fn() }
  const namespace = { use: vi.fn(), sockets: new Map([['socket', socket]]), to: vi.fn(() => ({ emit: vi.fn() })) }
  const refresh = vi.fn(async () => { throw new Error('revoked') })
  initializeOperationGateway({ of: () => namespace } as any, async () => null, { authenticate: vi.fn(), refresh })
  const { announceOperation } = await import('../../src/modules/operations/operation.gateway.js')
  await announceOperation('owner', 'job')
  expect(refresh).toHaveBeenCalledWith(socket)
  expect(socket.disconnect).toHaveBeenCalledWith(true)
})
