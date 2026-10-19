import { Device } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { isValidUuid } from '../../common/utils.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'

export function formatDevice(d: Device) {
  return {
    id: d.id,
    name: d.name,
    location: d.location,
    ip: d.ip || null,
    status: (d.status === 'MAINTENANCE' ? 'MAINTENANCE' : d.last_seen && Date.now() - +d.last_seen < 60000 ? d.status : 'OFFLINE') as 'ONLINE' | 'OFFLINE' | 'MAINTENANCE',
    lastSeen: d.last_seen ? d.last_seen.toISOString() : null,
    createdAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
  }
}

export async function list() {
  const devices = await prisma.device.findMany({
    orderBy: { createdAt: 'desc' },
  })
  const result = devices.map(formatDevice)
  try {
    const target = await resolveTbDevice(process.env.TB_DEVICE_NAME || 'PI4_FRONT_GATE')
    const attributes = await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/values/attributes/SERVER_SCOPE?keys=lastActivityTime,active`) as Array<{ key: string; value: unknown }>
    const last = Number(attributes.find(a => a.key === 'lastActivityTime')?.value || 0)
    const active = attributes.find(a => a.key === 'active')?.value === true
    const status = active && Date.now() - last < 60000 ? 'ONLINE' as const : 'OFFLINE' as const
    const item = result.find(d => d.name === target.name)
    if (item) { item.status = status; item.lastSeen = last ? new Date(last).toISOString() : null }
    else result.push({ id: target.id.id, name: target.name, location: 'Pi Edge', ip: null, status,
      lastSeen: last ? new Date(last).toISOString() : null, createdAt: new Date(target.createdTime).toISOString() })
  } catch { /* existing devices stay offline unless their last_seen is recent */ }
  return result
}

export async function get(id: string) {
  const device = await prisma.device.findUnique({
    where: { id },
  })
  if (!device) throw new AppError(404, 'Device not found')
  return formatDevice(device)
}

export async function create(
  data: { name: string; location: string; ip?: string | null; status?: string },
  actorUserId?: string,
) {
  const device = await prisma.device.create({
    data: {
      name: data.name,
      location: data.location,
      ip: data.ip ?? null,
      status: data.status ?? 'OFFLINE',
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'CREATE_DEVICE',
    target_table: 'devices',
    record_id: device.id,
    new_values: {
      name: device.name,
      location: device.location,
      ip: device.ip,
      status: device.status,
    },
  })

  return formatDevice(device)
}

export async function update(
  id: string,
  data: { name?: string; location?: string; ip?: string | null; status?: string },
  actorUserId?: string,
) {
  const existing = await get(id)
  const updated = await prisma.device.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.location !== undefined ? { location: data.location } : {}),
      ...(data.ip !== undefined ? { ip: data.ip } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'UPDATE_DEVICE',
    target_table: 'devices',
    record_id: id,
    old_values: {
      name: existing.name,
      location: existing.location,
      ip: existing.ip,
      status: existing.status,
    },
    new_values: {
      name: updated.name,
      location: updated.location,
      ip: updated.ip,
      status: updated.status,
    },
  })

  return formatDevice(updated)
}

export async function remove(id: string, actorUserId?: string): Promise<void> {
  const existing = await get(id)
  await prisma.device.delete({ where: { id } })

  await logAction({
    userId: actorUserId,
    action: 'DELETE_DEVICE',
    target_table: 'devices',
    record_id: id,
    old_values: {
      name: existing.name,
      location: existing.location,
      ip: existing.ip,
      status: existing.status,
    },
  })
}

export async function updateStatus(id: string, status: string) {
  try {
    const updated = await prisma.device.update({
      where: { id },
      data: { status, last_seen: new Date() },
    })
    return formatDevice(updated)
  } catch {
    return null
  }
}

let cachedTbJwt: { token: string; exp: number } | null = null
function tbBase() {
  const host = process.env.TB_HOST, port = process.env.TB_HTTP_PORT || '8081'
  if (!host) throw new AppError(503, 'Chưa cấu hình TB_HOST')
  return `http://${host}:${port}`
}
async function getThingsBoardToken(): Promise<string> {
  if (cachedTbJwt && cachedTbJwt.exp > Date.now() + 30000) return cachedTbJwt.token
  const response = await fetch(`${tbBase()}/api/auth/login`, { method: 'POST', signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: process.env.TB_USERNAME, password: process.env.TB_PASSWORD }) })
  if (!response.ok) throw new AppError(502, `ThingsBoard login failed (${response.status})`)
  const body = await response.json() as { token: string }
  if (!body.token) throw new AppError(502, 'ThingsBoard không trả token')
  let exp = Date.now() + 60000
  try { exp = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString()).exp * 1000 } catch { /* short cache */ }
  cachedTbJwt = { token: body.token, exp }
  return body.token
}
async function tbRequest(path: string, data?: unknown, retry = true): Promise<any> {
  const token = await getThingsBoardToken()
  const response = await fetch(tbBase() + path, { method: data === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
    body: data === undefined ? undefined : JSON.stringify(data) })
  if (response.status === 401 && retry) { cachedTbJwt = null; return tbRequest(path, data, false) }
  if (!response.ok) throw new AppError(502, `ThingsBoard ${response.status}: không thể xác nhận trạng thái thiết bị`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
async function resolveTbDevice(deviceId: string): Promise<{ id: { id: string }; name: string; createdTime: number }> {
  let name = deviceId
  if (isValidUuid(deviceId)) {
    const stored = await prisma.device.findUnique({ where: { id: deviceId } })
    if (stored) name = stored.name
    else return tbRequest(`/api/device/${deviceId}`)
  }
  return tbRequest('/api/tenant/devices?deviceName=' + encodeURIComponent(name))
}
export async function getDeviceAttendanceMode(deviceId: string) {
  const target = await resolveTbDevice(deviceId)
  const value = await tbRequest(`/api/rpc/twoway/${target.id.id}`, { method: 'getValue', params: {}, timeout: 8000 })
  if (typeof value !== 'boolean') throw new AppError(502, 'Pi chưa xác nhận chế độ')
  return { deviceId, mode: value ? 'CHECK_IN' as const : 'CHECK_OUT' as const, confirmed: true }
}
export async function setDeviceAttendanceMode(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT') {
  const target = await resolveTbDevice(deviceId)
  const value = await tbRequest(`/api/rpc/twoway/${target.id.id}`, { method: 'setValue', params: mode === 'CHECK_IN', timeout: 8000 })
  if (value !== (mode === 'CHECK_IN')) throw new AppError(502, 'Pi không xác nhận chế độ yêu cầu')
  // Persist desired mode only after a device acknowledgement. Never report success on HTTP errors.
  await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, { attendance_mode: mode, mode_changed_at: Date.now() })
  return { deviceId, mode, confirmed: true }
}

export async function persistConfirmedAttendanceMode(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT') {
  const target = await resolveTbDevice(deviceId)
  await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, { attendance_mode: mode, mode_changed_at: Date.now() })
}
