import { beforeEach, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => {
  const table = () => ({ findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(),
    update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), aggregate: vi.fn(), upsert: vi.fn() })
  return { $transaction: vi.fn(), $executeRaw: vi.fn(), fingerprintSession: table(), fingerprintTemplate: table(),
    fingerprintBinding: table(), fingerprintDevice: table(), employee: table(), attendance_logs: table() }
})
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/config/env.js', () => ({ env: { BIOMETRIC_ENCRYPTION_KEY: 'test-key-with-at-least-32-characters' } }))
vi.mock('../../src/modules/employees/public.js', () => ({ assertCanManageEmployee: vi.fn(), findEmployeeByIdOrCode: vi.fn(async () => ({ id: 'employee-a', status: 'ACTIVE', user_id: 'other-user' })), setFingerprintEnrolledStatus: vi.fn(async (id: string, enrolled: boolean, tx: any) => (tx || db).employee.update({ where: { id }, data: { fingerprint_enrolled: enrolled } })) }))
vi.mock('../../src/modules/devices/device.service.js', () => ({ triggerDeviceAction: vi.fn(async () => ({})) }))
vi.mock('../../src/common/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }))
import { eventBus } from '../../src/common/event-bus.js'
import { encryptPayload } from '../../src/common/biometric-crypto.js'
import { publicFingerprintSession, confirmFingerprintSession, cancelFingerprintSession, fingerprintProgress,
  acknowledgeFingerprintBinding, fingerprintManifest, fingerprintTemplateForDevice, startFingerprintSession } from '../../src/modules/biometrics/fingerprint.service.js'
import { processFingerprintAttendance } from '../../src/modules/biometrics/fingerprint.attendance.js'
const actor = { id: 'admin-a', role: 'ADMIN' }
const session = () => ({ id: 'session-a', employee_id: 'employee-a', owner_id: 'admin-a', device_id: 'PI_A',
  finger_name: 'Index', key: 'request-a', status: 'VERIFIED', match_score: 132, confirm_key: null, template_id: null,
  ciphertext: encryptPayload({ template_b64: Buffer.alloc(512, 42).toString('base64') }, 'test-key-with-at-least-32-characters'),
  checksum: 'a'.repeat(64), expires_at: new Date(Date.now()+600_000) })
const device = () => ({ device_id: 'PI_A', ready: true, roundtrip_verified: true, wak_verified: true,
  capacity: 300, last_seen: new Date(), attendance_enabled: true })
const binding = () => ({ id: '12345678-1234-4234-8234-123456789abc', device_id: 'PI_A', slot: 2, state: 'SYNCED', template_id: 'template-a',
  template: { id: 'template-a', employee_id: 'employee-a', revision: 2, checksum: 'a'.repeat(64), status: 'ACTIVE',
    employee: { id: 'employee-a', full_name: 'Alice', employee_code: 'A', status: 'ACTIVE' } } })
beforeEach(() => {
  vi.clearAllMocks()
  db.$transaction.mockImplementation(async callback => callback(db))
  db.fingerprintSession.findUnique.mockResolvedValue(session())
  db.fingerprintSession.findUniqueOrThrow.mockResolvedValue(session())
  db.fingerprintSession.update.mockImplementation(async ({ data }) => ({ ...session(), ...data }))
  db.fingerprintSession.findFirst.mockResolvedValue(null)
  db.fingerprintDevice.findUnique.mockResolvedValue(device())
  db.fingerprintDevice.upsert.mockResolvedValue(device())
  db.fingerprintBinding.findMany.mockResolvedValue([])
  db.fingerprintBinding.findUnique.mockResolvedValue(binding())
  db.fingerprintBinding.findUniqueOrThrow.mockResolvedValue(binding())
  db.fingerprintTemplate.aggregate.mockResolvedValue({ _max: { revision: 1 } })
  db.fingerprintTemplate.findMany.mockResolvedValue([{ id: 'old-template' }])
  db.fingerprintTemplate.create.mockImplementation(async ({ data }) => ({ id: 'new-template', ...data }))
  db.attendance_logs.findUnique.mockResolvedValue(null)
  db.attendance_logs.findFirst.mockResolvedValue(null)
})
it('public sessions and events never expose encrypted input or templates', async () => {
  const result = publicFingerprintSession(session())
  expect(JSON.stringify(result)).not.toMatch(/ciphertext|template_b64|checksum/)
  await cancelFingerprintSession(actor, 'employee-a', 'session-a')
  expect(JSON.stringify(vi.mocked(eventBus.publish).mock.calls)).not.toMatch(/ciphertext|template_b64|checksum/)
})
it('confirmation allocates a new slot and keeps the old active template untouched', async () => {
  db.fingerprintBinding.findMany.mockResolvedValue([{ slot: 0 }, { slot: 1 }])
  const result = await confirmFingerprintSession(actor, 'employee-a', 'session-a', 'confirm-a')
  expect(result.status).toBe('SYNCING')
  expect(db.fingerprintBinding.create).toHaveBeenCalledWith({ data: { template_id: 'new-template', device_id: 'PI_A', slot: 2 } })
  expect(db.fingerprintTemplate.updateMany).not.toHaveBeenCalled()
  expect(db.employee.update).not.toHaveBeenCalled()
})
it('full capacity refuses replacement without deleting any old slot', async () => {
  db.fingerprintDevice.findUnique.mockResolvedValue({ ...device(), capacity: 2 })
  db.fingerprintBinding.findMany.mockResolvedValue([{ slot: 0 }, { slot: 1 }])
  await expect(confirmFingerprintSession(actor, 'employee-a', 'session-a', 'confirm-a')).rejects.toMatchObject({ statusCode: 409 })
  expect(db.fingerprintTemplate.create).not.toHaveBeenCalled()
  expect(db.fingerprintBinding.delete).not.toHaveBeenCalled()
})
it('confirmation retries recover the same operation rather than allocate again', async () => {
  db.fingerprintSession.findUniqueOrThrow.mockResolvedValue({ ...session(), confirm_key: 'confirm-a', status: 'SYNCING' })
  expect((await confirmFingerprintSession(actor, 'employee-a', 'session-a', 'confirm-a')).status).toBe('SYNCING')
  expect(db.fingerprintTemplate.create).not.toHaveBeenCalled()
  await expect(confirmFingerprintSession(actor, 'employee-a', 'session-a', 'different')).rejects.toMatchObject({ statusCode: 409 })
})
it('sync failure keeps the old template and records retryable sync error only', async () => {
  await acknowledgeFingerprintBinding('PI_A', binding().id, { error: 'SYNC_FAILED' })
  expect(db.fingerprintBinding.update).toHaveBeenCalledWith(expect.objectContaining({ data: { error: expect.any(String) } }))
  expect(db.fingerprintTemplate.updateMany).not.toHaveBeenCalled()
  expect(db.employee.update).not.toHaveBeenCalled()
})
it('only a matching checksum/revision promotes a replacement', async () => {
  db.fingerprintBinding.findUniqueOrThrow.mockResolvedValue({ ...binding(), state: 'PENDING', template: { ...binding().template, status: 'PENDING' } })
  await expect(acknowledgeFingerprintBinding('PI_A', binding().id, { checksum: 'wrong', revision: 2 })).rejects.toMatchObject({ statusCode: 409 })
  expect(db.employee.update).not.toHaveBeenCalled()
  await acknowledgeFingerprintBinding('PI_A', binding().id, { checksum: 'a'.repeat(64), revision: 2 })
  expect(db.fingerprintTemplate.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'REVOKED' } }))
  expect(db.employee.update).toHaveBeenCalledWith({ where: { id: 'employee-a' }, data: { fingerprint_enrolled: true } })
})
it('cancelled sessions revoke only their pending replacement', async () => {
  db.fingerprintSession.findUniqueOrThrow.mockResolvedValue({ ...session(), status: 'SYNCING', template_id: 'pending-a' })
  await cancelFingerprintSession(actor, 'employee-a', 'session-a')
  expect(db.fingerprintTemplate.updateMany).toHaveBeenCalledWith({ where: { id: 'pending-a', status: 'PENDING' }, data: { status: 'REVOKED' } })
})
it('wrong-device progress and illegal state transitions are rejected', async () => {
  await expect(fingerprintProgress('PI_B', 'session-a', { status: 'VERIFIED' })).rejects.toMatchObject({ statusCode: 404 })
  await expect(fingerprintProgress('PI_A', 'session-a', { status: 'WAITING_TOUCH_1' })).rejects.toMatchObject({ statusCode: 409 })
})
it('rejects an enrolled finger owned by a different employee', async () => {
  db.fingerprintSession.findUnique.mockResolvedValue({ ...session(), status: 'WAITING_TOUCH_2' })
  db.fingerprintBinding.findUnique.mockResolvedValue({ ...binding(), template: { ...binding().template, employee_id: 'employee-b' } })
  await expect(fingerprintProgress('PI_A', 'session-a', { status: 'VERIFIED', template_b64: Buffer.alloc(512,42).toString('base64'), match_score: 132,
    roundtrip_verified: true, duplicate_binding_id: binding().id })).rejects.toMatchObject({ statusCode: 409 })
})
it('manifest only requests bindings belonging to the authenticated Pi', async () => {
  await fingerprintManifest('PI_A', { capacity: 300, ready: true, wak_verified: true, roundtrip_verified: true, error: null })
  expect(db.fingerprintBinding.findMany).toHaveBeenCalledWith({ where: { device_id: 'PI_A' }, include: { template: true } })
})
it('v2 manifest never selects ciphertext, including the live session', async () => {
  const b = binding()
  db.fingerprintBinding.findMany.mockResolvedValue([b])
  db.fingerprintSession.findFirst.mockResolvedValue(session())
  const result = await fingerprintManifest('PI_A', { capacity: 300, ready: true, wak_verified: true, roundtrip_verified: true, error: null }, 2)
  expect(result).toMatchObject({ manifest_version: 2, bindings: [{ id: b.id, revision: 2 }] })
  expect(JSON.stringify(result)).not.toMatch(/ciphertext|template_b64/)
  for (const table of [db.fingerprintBinding, db.fingerprintSession]) {
    const args = table.findMany === db.fingerprintBinding.findMany ? table.findMany.mock.calls[0][0] : table.findFirst.mock.calls[0][0]
    expect(args.include).toBeUndefined()
    expect(args.select).toBeDefined()
    expect(JSON.stringify(args.select)).not.toMatch(/ciphertext/)
  }
})
it('template download filters device, state, revision and checksum in SQL', async () => {
  const b = binding()
  db.fingerprintBinding.findFirst.mockResolvedValue({ ...b, template: { ...b.template, ciphertext: session().ciphertext } })
  expect(await fingerprintTemplateForDevice('PI_A', b.id, 2, b.template.checksum)).toMatchObject({ revision: 2, template_b64: expect.any(String) })
  expect(db.fingerprintBinding.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
    id: b.id, device_id: 'PI_A', state: { in: ['PENDING', 'SYNCED'] },
    template: { status: { in: ['PENDING', 'ACTIVE'] }, revision: 2, checksum: b.template.checksum },
  } }))
  db.fingerprintBinding.findFirst.mockResolvedValue(null)
  await expect(fingerprintTemplateForDevice('PI_B', b.id, 2, b.template.checksum)).rejects.toMatchObject({ statusCode: 404 })
})
it('allows assigned inactive-employee templates to recover without authorizing their attendance', async () => {
  const b = binding()
  db.fingerprintBinding.findFirst.mockImplementation(async ({ where }: any) => {
    // Employee status can change independently without revoking an assigned binding.
    if (where.template.employee?.status === 'ACTIVE') return null
    return { ...b, template: { ...b.template, employee: { ...b.template.employee, status: 'INACTIVE' }, ciphertext: session().ciphertext } }
  })
  await expect(fingerprintTemplateForDevice('PI_A', b.id, 2, b.template.checksum)).resolves.toHaveProperty('template_b64')
  db.fingerprintBinding.findUnique.mockResolvedValue({ ...b, template: { ...b.template, employee: { ...b.template.employee, status: 'INACTIVE' } } })
  const checkIn = vi.fn()
  await expect(processFingerprintAttendance({ device_id: 'PI_A', event_id: 'inactive-employee-event', client_timestamp: Date.now(), mode: 'AUTO',
    event_kind: 'FINGERPRINT_SCAN', binding_id: b.id, slot: 2, revision: 2, match_score: 132 }, { checkIn, checkOut: vi.fn() } as any)).rejects.toMatchObject({ statusCode: 403 })
  expect(checkIn).not.toHaveBeenCalled()
})
it('idempotent creation checks all original request fields', async () => {
  db.fingerprintSession.findUnique.mockResolvedValue({ ...session(), key: 'request-a' })
  expect((await startFingerprintSession(actor, 'employee-a','PI_A','Index','request-a')).id).toBe('session-a')
  await expect(startFingerprintSession(actor,'employee-a','PI_B','Index','request-a')).rejects.toMatchObject({statusCode:409})
})
it('fingerprint scan derives employee from active binding and preserves writer cooldown', async () => {
  const checkIn = vi.fn(async () => ({ status: 'VALID', ignored: true, cooldown: true, retry_after_seconds: 5 }))
  const request = { device_id: 'PI_A', event_id: 'fingerprint-event-a', client_timestamp: Date.now(), mode: 'AUTO',
    event_kind: 'FINGERPRINT_SCAN', binding_id: binding().id, slot: 2, revision: 2, match_score: 132, employee_id: 'forged' }
  const result = await processFingerprintAttendance(request, { checkIn, checkOut: vi.fn() } as any)
  expect(result).toMatchObject({ matched: true, door_open: false, cooldown: true, employee: { id: 'employee-a' }, method: 'FINGERPRINT' })
  expect(checkIn).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'employee-a', method: 'FINGERPRINT' }), undefined,
    expect.objectContaining({ method: 'FINGERPRINT', fingerprint: expect.objectContaining({ binding_id: binding().id }) }))
  db.fingerprintDevice.findUnique.mockResolvedValue({ ...device(), attendance_enabled: false })
  await expect(processFingerprintAttendance(request, { checkIn, checkOut: vi.fn() } as any)).rejects.toMatchObject({ statusCode: 403 })
})
