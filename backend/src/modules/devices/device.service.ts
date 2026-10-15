import { Device } from '@prisma/client'
import { prisma } from '../../config/database.js'
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
  if (cachedTbJwt && Date.now() < cachedTbJwt.exp - 60000) {
    return cachedTbJwt.token
  }
  try {
    const res = await fetch(`http://${tbHost}:${tbPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.TB_USERNAME || 'tenant@thingsboard.org',
        password: process.env.TB_PASSWORD || 'tenant',
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as any
    cachedTbJwt = { token: data.token, exp: Date.now() + 2 * 3600 * 1000 }
    return data.token
  } catch (err) {
    console.warn('[ThingsBoard] Could not login to ThingsBoard API:', err)
    return null
  }
}

export async function setDeviceAttendanceMode(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT') {
  const tbHost = process.env.TB_HOST || '10.52.138.36'
  const tbPort = process.env.TB_HTTP_PORT || '8080'
  const tbToken = process.env.TB_DEVICE_TOKEN || 'ivu62ZoR6gkXyqqoDobJ'
  const tbDeviceId = process.env.TB_DEVICE_UUID || 'efbab930-c7f6-11f1-b4f0-4bfc18af14d5'

  try {
    // 1. Gửi Telemetry thô qua Device token
    await fetch(`http://${tbHost}:${tbPort}/api/v1/${tbToken}/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_mode: mode, mode }),
    }).catch(() => {})

    // 2. Gửi Shared Attribute & Timeseries với quyền Tenant qua ThingsBoard REST API
    const jwt = await getThingsBoardToken(tbHost, tbPort)
    if (jwt) {
      await Promise.all([
        // Cập nhật SHARED_SCOPE -> ThingsBoard tự động đẩy MQTT xuống Pi 4
        fetch(`http://${tbHost}:${tbPort}/api/plugins/telemetry/DEVICE/${tbDeviceId}/SHARED_SCOPE`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({ attendance_mode: mode }),
        }),
        // Cập nhật Timeseries -> Dashboard Widgets đổi trạng thái thời gian thực
        fetch(`http://${tbHost}:${tbPort}/api/plugins/telemetry/DEVICE/${tbDeviceId}/timeseries/ANY`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': `Bearer ${jwt}`,
          },
          body: JSON.stringify({ current_mode: mode, mode }),
        }),
      ])
      console.log(`[ThingsBoard] Đã đồng bộ mode '${mode}' lên Shared Attribute và Telemetry`)
    }
  } catch (err) {
    console.warn('[ThingsBoard] Could not sync mode to ThingsBoard:', err)
  }

  return { deviceId, mode }
}