import { Device } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'

export function formatDevice(d: Device) {
  return {
    id: d.id,
    name: d.name,
    location: d.location,
    ip: d.ip || null,
    status: d.status as 'ONLINE' | 'OFFLINE' | 'MAINTENANCE',
    lastSeen: d.last_seen ? d.last_seen.toISOString() : null,
    createdAt: d.createdAt ? d.createdAt.toISOString() : new Date().toISOString(),
  }
}

export async function list() {
  const devices = await prisma.device.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return devices.map(formatDevice)
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

async function getThingsBoardToken(tbHost: string, tbPort: string): Promise<string | null> {
  if (!tbHost || !env.TB_USERNAME || !env.TB_PASSWORD) {
    return null
  }
  if (cachedTbJwt && Date.now() < cachedTbJwt.exp - 60000) {
    return cachedTbJwt.token
  }
  try {
    const res = await fetch(`http://${tbHost}:${tbPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: env.TB_USERNAME,
        password: env.TB_PASSWORD,
      }),
      signal: AbortSignal.timeout(600),
    })
    if (!res.ok) return null
    const data = (await res.json()) as any
    cachedTbJwt = { token: data.token, exp: Date.now() + 2 * 3600 * 1000 }
    return data.token
  } catch {
    return null
  }
}

export interface DeviceModeState {
  deviceId: string
  mode: 'CHECK_IN' | 'CHECK_OUT' | null
  confirmed: boolean
  lastUpdated?: string
}

// Lưu trữ trạng thái chế độ thực tế của thiết bị đã được ACK từ Raspberry Pi
const deviceModeStore = new Map<string, DeviceModeState>()

// Bộ điều phối chờ ACK từ Pi khi Web App gửi lệnh PATCH đổi chế độ
const pendingModeAcks = new Map<string, { mode: 'CHECK_IN' | 'CHECK_OUT'; resolve: (confirmed: boolean) => void }>()

export function recordDeviceModeNotify(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT'): DeviceModeState {
  const state: DeviceModeState = {
    deviceId,
    mode,
    confirmed: true,
    lastUpdated: new Date().toISOString(),
  }
  deviceModeStore.set(deviceId, state)

  // Nếu có request PATCH /mode đang chờ ACK từ Pi, hoàn thành ngay lập tức
  const pending = pendingModeAcks.get(deviceId)
  if (pending && pending.mode === mode) {
    pending.resolve(true)
    pendingModeAcks.delete(deviceId)
  }

  return state
}

export async function getDeviceMode(deviceId: string): Promise<DeviceModeState> {
  const cached = deviceModeStore.get(deviceId)
  if (cached) {
    return cached
  }
  // Mặc định lần đầu khi chưa nhận được xác nhận từ Pi -> confirmed = false, mode = null
  return {
    deviceId,
    mode: null,
    confirmed: false,
  }
}

export async function setDeviceAttendanceMode(
  deviceId: string,
  mode: 'CHECK_IN' | 'CHECK_OUT'
): Promise<{ deviceId: string; mode: string; confirmed: boolean }> {
  const tbHost = env.TB_HOST
  const tbPort = env.TB_HTTP_PORT
  const tbToken = env.TB_DEVICE_TOKEN
  const tbDeviceId = env.TB_DEVICE_UUID

  // Thiết lập Promise chờ ACK từ Pi qua /api/devices/:id/mode-notify trong tối đa 1500ms
  let ackTimeout: NodeJS.Timeout
  const ackPromise = new Promise<boolean>((resolve) => {
    pendingModeAcks.set(deviceId, {
      mode,
      resolve: (val) => {
        clearTimeout(ackTimeout)
        resolve(val)
      },
    })
    ackTimeout = setTimeout(() => {
      pendingModeAcks.delete(deviceId)
      // Nếu không có ACK từ Pi trong thời gian chờ -> confirmed = false
      resolve(false)
    }, 1500)
  })

  // Đồng bộ ThingsBoard đồng thời (non-blocking với timeout an toàn)
  const syncToThingsBoard = async () => {
    if (!tbHost || !tbToken) return
    try {
      await fetch(`http://${tbHost}:${tbPort}/api/v1/${tbToken}/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_mode: mode, mode }),
        signal: AbortSignal.timeout(600),
      }).catch(() => {})

      const jwt = await getThingsBoardToken(tbHost, tbPort)
      if (jwt) {
        await Promise.all([
          fetch(`http://${tbHost}:${tbPort}/api/plugins/telemetry/DEVICE/${tbDeviceId}/SHARED_SCOPE`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ attendance_mode: mode }),
            signal: AbortSignal.timeout(600),
          }),
          fetch(`http://${tbHost}:${tbPort}/api/plugins/telemetry/DEVICE/${tbDeviceId}/timeseries/ANY`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Authorization': `Bearer ${jwt}`,
            },
            body: JSON.stringify({ current_mode: mode, mode }),
            signal: AbortSignal.timeout(600),
          }),
        ]).catch(() => {})
      }
    } catch {
      // Bỏ qua lỗi kết nối tới ThingsBoard khi chạy offline / dev
    }
  }

  syncToThingsBoard().catch(() => {})

  const confirmed = await ackPromise
  if (confirmed) {
    deviceModeStore.set(deviceId, {
      deviceId,
      mode,
      confirmed: true,
      lastUpdated: new Date().toISOString(),
    })
  }

  return { deviceId, mode, confirmed }
}