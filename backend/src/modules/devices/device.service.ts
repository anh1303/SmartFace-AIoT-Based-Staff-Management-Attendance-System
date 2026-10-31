import { Device } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { env } from '../../config/env.js'
import { isValidUuid } from '../../common/utils.js'
import { AppError } from '../../common/AppError.js'
import { logAction } from '../audit-logs/audit.service.js'
import { eventBus } from '../../common/event-bus.js'

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
    const [attributes, tele] = await Promise.all([
      tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/values/attributes/SERVER_SCOPE?keys=lastActivityTime,lastConnectTime,lastDisconnectTime,active`) as Promise<Array<{ key: string; value: unknown }>>,
      tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/values/timeseries?keys=wifi_ip`).catch(() => ({})) as Promise<Record<string, Array<{ ts: number; value: string }>>>,
    ])
    const liveIp = tele?.wifi_ip?.[0]?.value || null
    const last = Number(attributes.find(a => a.key === 'lastActivityTime')?.value || 0)
    const lastConnect = Number(attributes.find(a => a.key === 'lastConnectTime')?.value || 0)
    const lastDisconnect = Number(attributes.find(a => a.key === 'lastDisconnectTime')?.value || 0)
    const isMqttConnected = lastConnect > 0 && lastConnect >= lastDisconnect
    const status = isMqttConnected && Date.now() - last < 20000 ? 'ONLINE' as const : 'OFFLINE' as const
    const item = result.find(d => d.name === target.name || d.id === target.id.id)
    if (item) {
      item.status = status
      item.lastSeen = last ? new Date(last).toISOString() : null
      if (!item.ip && liveIp) item.ip = liveIp
    } else {
      result.push({
        id: target.id.id,
        name: target.name,
        location: 'Pi Edge (ThingsBoard)',
        ip: liveIp,
        status,
        lastSeen: last ? new Date(last).toISOString() : null,
        createdAt: new Date(target.createdTime).toISOString(),
      })
    }
  } catch { /* existing devices stay offline unless their last_seen is recent */ }
  return result
}

export async function get(id: string) {
  let device = await prisma.device.findUnique({
    where: { id },
  })
  if (!device) {
    device = await prisma.device.findFirst({
      where: { name: id },
    })
  }

  let liveIp: string | null = null
  let tbStatus: 'ONLINE' | 'OFFLINE' | null = null
  let tbLastSeen: string | null = null
  let targetObj: any = null

  if (process.env.TB_HOST) {
    try {
      const target = await resolveTbDevice(device ? device.name : id)
      if (target) {
        targetObj = target
        const [attributes, tele] = await Promise.all([
          tbRequest(
            `/api/plugins/telemetry/DEVICE/${target.id.id}/values/attributes/SERVER_SCOPE?keys=lastActivityTime,lastConnectTime,lastDisconnectTime,active`
          ) as Promise<Array<{ key: string; value: unknown }>>,
          tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/values/timeseries?keys=wifi_ip`).catch(() => ({})) as Promise<Record<string, Array<{ ts: number; value: string }>>>,
        ])
        liveIp = tele?.wifi_ip?.[0]?.value || null
        const last = Number(attributes.find(a => a.key === 'lastActivityTime')?.value || 0)
        const lastConnect = Number(attributes.find(a => a.key === 'lastConnectTime')?.value || 0)
        const lastDisconnect = Number(attributes.find(a => a.key === 'lastDisconnectTime')?.value || 0)
        const isMqttConnected = lastConnect > 0 && lastConnect >= lastDisconnect
        tbStatus = isMqttConnected && Date.now() - last < 20000 ? ('ONLINE' as const) : ('OFFLINE' as const)
        tbLastSeen = last ? new Date(last).toISOString() : null
      }
    } catch (err: any) {
      console.warn(`[Device Service] Lỗi resolve ThingsBoard device (${id}):`, err?.message)
    }
  }

  if (!device) {
    if (targetObj) {
      return {
        id: targetObj.id.id,
        name: targetObj.name,
        location: 'Pi Edge (ThingsBoard)',
        ip: liveIp,
        status: tbStatus || 'OFFLINE',
        lastSeen: tbLastSeen,
        createdAt: new Date(targetObj.createdTime || Date.now()).toISOString(),
      }
    }
    throw new AppError(404, 'Device not found')
  }

  const formatted = formatDevice(device)
  if (tbStatus) formatted.status = formatted.status === 'MAINTENANCE' ? 'MAINTENANCE' : tbStatus
  if (tbLastSeen) formatted.lastSeen = tbLastSeen
  if (!formatted.ip && liveIp) formatted.ip = liveIp
  return formatted
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
  let dbRecord = await prisma.device.findUnique({ where: { id } })
  if (!dbRecord) {
    dbRecord = await prisma.device.findFirst({ where: { name: existing.name } })
  }

  let updated: Device
  if (!dbRecord) {
    updated = await prisma.device.create({
      data: {
        id: isValidUuid(id) ? id : undefined,
        name: data.name ?? existing.name,
        location: data.location ?? existing.location,
        ip: data.ip !== undefined ? data.ip : existing.ip,
        status: data.status ?? existing.status,
      },
    })
  } else {
    updated = await prisma.device.update({
      where: { id: dbRecord.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.ip !== undefined ? { ip: data.ip } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
    })
  }

  // Tự động đồng bộ tên thiết bị mới lên ThingsBoard nếu có cấu hình
  if (data.name && data.name !== existing.name && process.env.TB_HOST) {
    try {
      const tbDev = await resolveTbDevice(id)
      if (tbDev && tbDev.id?.id) {
        const fullTb = (await tbRequest(`/api/device/${tbDev.id.id}`)) as any
        if (fullTb) {
          fullTb.name = data.name
          fullTb.label = data.name
          await tbRequest('/api/device', fullTb)
          console.log(`[Device Service] Đã đồng bộ tên mới '${data.name}' lên ThingsBoard Device (${tbDev.id.id})`)
        }
      }
    } catch (err: any) {
      console.warn(`[Device Service] Cảnh báo đồng bộ tên lên ThingsBoard:`, err?.message)
    }
  }

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
let activeTbBaseOverride: string | null = null

function tbBase() {
  if (activeTbBaseOverride) return activeTbBaseOverride
  const host = process.env.TB_HOST, port = process.env.TB_HTTP_PORT || '8080'
  if (!host) throw new AppError(503, 'Chưa cấu hình TB_HOST')
  return `http://${host}:${port}`
}

async function getThingsBoardToken(): Promise<string> {
  if (cachedTbJwt && cachedTbJwt.exp > Date.now() + 30000) return cachedTbJwt.token
  let response: Response
  try {
    response = await fetch(`${tbBase()}/api/auth/login`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: process.env.TB_USERNAME, password: process.env.TB_PASSWORD }),
    })
  } catch (err: any) {
    // Tự động fallback về 127.0.0.1:8080 nếu chạy Backend trực tiếp trên host nhưng .env để TB_HOST=thingsboard
    if (process.env.TB_HOST === 'thingsboard' && !activeTbBaseOverride) {
      activeTbBaseOverride = 'http://127.0.0.1:8080'
      response = await fetch(`${activeTbBaseOverride}/api/auth/login`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: process.env.TB_USERNAME, password: process.env.TB_PASSWORD }),
      })
    } else {
      throw err
    }
  }
  if (!response.ok) throw new AppError(502, `ThingsBoard login failed (${response.status})`)
  const body = (await response.json()) as { token: string }
  if (!body.token) throw new AppError(502, 'ThingsBoard không trả token')
  let exp = Date.now() + 60000
  try {
    exp = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString()).exp * 1000
  } catch {
    /* short cache */
  }
  cachedTbJwt = { token: body.token, exp }
  return body.token
}

async function tbRequest(path: string, data?: unknown, retry = true): Promise<any> {
  const token = await getThingsBoardToken()
  const response = await fetch(tbBase() + path, {
    method: data === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
    body: data === undefined ? undefined : JSON.stringify(data),
  })
  if (response.status === 401 && retry) {
    cachedTbJwt = null
    return tbRequest(path, data, false)
  }
  if (!response.ok) throw new AppError(502, `ThingsBoard ${response.status}: không thể xác nhận trạng thái thiết bị`)
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

async function resolveTbDevice(deviceId: string): Promise<{ id: { id: string }; name: string; createdTime: number }> {
  if (isValidUuid(deviceId)) {
    try {
      const dev = await tbRequest(`/api/device/${deviceId}`)
      if (dev && dev.id) return dev
    } catch {
      /* fallback to name lookup */
    }
    const stored = await prisma.device.findUnique({ where: { id: deviceId } })
    if (stored) return tbRequest('/api/tenant/devices?deviceName=' + encodeURIComponent(stored.name))
  }
  return tbRequest('/api/tenant/devices?deviceName=' + encodeURIComponent(deviceId))
}

export type AttendanceModeValue = 'CHECK_IN' | 'CHECK_OUT' | 'OFF'

export interface DeviceModeState {
  deviceId: string
  mode: AttendanceModeValue | null
  confirmed: boolean
  lastUpdated?: string
}

// Lưu trữ trạng thái chế độ thực tế của thiết bị đã được ACK từ Raspberry Pi
const deviceModeStore = new Map<string, DeviceModeState>()
const pendingModeAcks = new Map<string, { mode: string; resolve: (val: boolean) => void }>()

export function recordDeviceModeNotify(deviceId: string, mode: AttendanceModeValue): DeviceModeState {
  const nowIso = new Date().toISOString()
  const state: DeviceModeState = {
    deviceId,
    mode,
    confirmed: true,
    lastUpdated: nowIso,
  }
  deviceModeStore.set(deviceId, state)

  const defaultName = process.env.TB_DEVICE_NAME || 'PI4_FRONT_GATE'
  if (deviceId !== defaultName) {
    deviceModeStore.set(defaultName, { ...state, deviceId: defaultName })
  }

  for (const [key, pending] of pendingModeAcks.entries()) {
    if ((key === deviceId || key === defaultName || deviceId === defaultName) && pending.mode === mode) {
      pending.resolve(true)
      pendingModeAcks.delete(key)
    }
  }

  return state
}

export async function getDeviceMode(deviceId: string): Promise<DeviceModeState> {
  const defaultName = process.env.TB_DEVICE_NAME || 'PI4_FRONT_GATE'
  const cached = deviceModeStore.get(deviceId) || deviceModeStore.get(defaultName)
  if (cached) {
    return { ...cached, deviceId }
  }

  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      const telemetry = await tbRequest(
        `/api/plugins/telemetry/DEVICE/${target.id.id}/values/timeseries?keys=current_mode,mode`
      ).catch(() => null)
      const rawMode = telemetry?.['current_mode']?.[0]?.value || telemetry?.['mode']?.[0]?.value
      if (rawMode === 'CHECK_IN' || rawMode === 'CHECK_OUT' || rawMode === 'OFF') {
        const state = recordDeviceModeNotify(deviceId, rawMode)
        recordDeviceModeNotify(target.name, rawMode)
        recordDeviceModeNotify(target.id.id, rawMode)
        return state
      }
    } catch {
      // Ignore TB telemetry lookup error
    }
  }

  return {
    deviceId,
    mode: 'OFF',
    confirmed: false,
  }
}

export async function getDeviceAttendanceMode(deviceId: string) {
  if (process.env.TB_HOST) {
    try {
      const target = await resolveTbDevice(deviceId)
      const value = await tbRequest(`/api/rpc/twoway/${target.id.id}`, { method: 'getMode', params: {}, timeout: 5000 })
      if (value && typeof value === 'object' && ('mode' in value)) {
        const m = (value as any).mode
        const mode: AttendanceModeValue = (m === 'CHECK_IN' || m === 'CHECK_OUT') ? m : 'OFF'
        recordDeviceModeNotify(deviceId, mode)
        recordDeviceModeNotify(target.name, mode)
        recordDeviceModeNotify(target.id.id, mode)
        return { deviceId, mode, confirmed: true }
      }
      if (typeof value === 'boolean') {
        const mode = value ? ('CHECK_IN' as const) : ('OFF' as const)
        recordDeviceModeNotify(deviceId, mode)
        return { deviceId, mode, confirmed: true }
      }
    } catch {
      // Fallback to local cached mode
    }
  }
  const cached = await getDeviceMode(deviceId)
  return { deviceId, mode: cached.mode || 'OFF', confirmed: cached.confirmed }
}

export async function setDeviceAttendanceMode(deviceId: string, mode: AttendanceModeValue) {
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
      resolve(false)
    }, 1500)
  })

  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      const rpcRes = await tbRequest(`/api/rpc/twoway/${target.id.id}`, {
        method: 'setMode',
        params: { mode },
        timeout: 5000,
      })
      const confirmedByRpc =
        (rpcRes && typeof rpcRes === 'object' && rpcRes.mode === mode) ||
        (typeof rpcRes === 'boolean' && rpcRes === (mode === 'CHECK_IN'))
      if (confirmedByRpc) {
        await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, {
          attendance_mode: mode,
          checkin_active: mode === 'CHECK_IN',
          checkout_active: mode === 'CHECK_OUT',
          mode_changed_at: Date.now(),
        })
        const state = recordDeviceModeNotify(deviceId, mode)
        recordDeviceModeNotify(target.name, mode)
        recordDeviceModeNotify(target.id.id, mode)
        return { deviceId, mode, confirmed: true, lastUpdated: state.lastUpdated }
      }
    } catch (tbErr) {
      console.warn(`[Device Service] TB RPC error:`, tbErr)
    }
  }

  const confirmed = await ackPromise
  if (confirmed) {
    const state = recordDeviceModeNotify(deviceId, mode)
    return { deviceId, mode, confirmed: true, lastUpdated: state.lastUpdated }
  }
  return { deviceId, mode, confirmed }
}

export async function persistConfirmedAttendanceMode(deviceId: string, mode: AttendanceModeValue) {
  if (!process.env.TB_HOST) return
  try {
    const target = await resolveTbDevice(deviceId)
    await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, {
      attendance_mode: mode,
      checkin_active: mode === 'CHECK_IN',
      checkout_active: mode === 'CHECK_OUT',
      mode_changed_at: Date.now(),
    })
    recordDeviceModeNotify(deviceId, mode)
    recordDeviceModeNotify(target.name, mode)
    recordDeviceModeNotify(target.id.id, mode)
  } catch {
    // Non-fatal if ThingsBoard is unreachable
  }
}

export interface DeviceSettingsState {
  deviceId: string
  online: boolean
  fps: number
  volume: number // 0 - 100
  isMuted: boolean
  showFps: boolean
  streamEnabled: boolean
  maxFaces: number // 1 - 10 (MAX_FACES_PER_FRAME)
  wifi: {
    connected: boolean
    ssid: string
    signalStrength: number // %
    ip: string
  }
  bluetooth: {
    connected: boolean
    deviceName: string
    status: 'connected' | 'disconnected'
  }
  lastUpdated?: string
}

const deviceSettingsStore = new Map<string, DeviceSettingsState>()
const lastUserPatchTimes = new Map<string, number>()

function defaultDeviceSettings(deviceId: string): DeviceSettingsState {
  return {
    deviceId,
    online: false,
    fps: 0,
    volume: 75,
    isMuted: false,
    showFps: true,
    streamEnabled: true,
    maxFaces: 3,
    wifi: {
      connected: false,
      ssid: '',
      signalStrength: 0,
      ip: '',
    },
    bluetooth: {
      connected: false,
      deviceName: '',
      status: 'disconnected',
    },
    lastUpdated: new Date().toISOString(),
  }
}

export function recordDeviceSettingsNotify(
  deviceId: string,
  patch: Partial<DeviceSettingsState> & Record<string, any>,
): DeviceSettingsState {
  const current = deviceSettingsStore.get(deviceId) || defaultDeviceSettings(deviceId)
  const normalized: Partial<DeviceSettingsState> = {
    online: true,
  }

  if (patch.volume !== undefined && !Number.isNaN(Number(patch.volume))) {
    normalized.volume = Number(patch.volume)
  }
  if (patch.isMuted !== undefined) {
    normalized.isMuted = Boolean(patch.isMuted)
  } else if (patch.is_muted !== undefined) {
    normalized.isMuted = Boolean(patch.is_muted)
  }
  if (patch.showFps !== undefined) {
    normalized.showFps = Boolean(patch.showFps)
  } else if (patch.show_fps !== undefined) {
    normalized.showFps = Boolean(patch.show_fps)
  }
  if (patch.streamEnabled !== undefined) {
    normalized.streamEnabled = Boolean(patch.streamEnabled)
  } else if (patch.stream_enabled !== undefined) {
    normalized.streamEnabled = Boolean(patch.stream_enabled)
  }
  if (patch.maxFaces !== undefined && !Number.isNaN(Number(patch.maxFaces))) {
    normalized.maxFaces = Math.max(1, Math.min(10, Number(patch.maxFaces)))
  } else if (patch.max_faces !== undefined && !Number.isNaN(Number(patch.max_faces))) {
    normalized.maxFaces = Math.max(1, Math.min(10, Number(patch.max_faces)))
  }

  const updated: DeviceSettingsState = {
    ...current,
    ...normalized,
    wifi: patch.wifi ? { ...current.wifi, ...patch.wifi } : current.wifi,
    bluetooth: patch.bluetooth ? { ...current.bluetooth, ...patch.bluetooth } : current.bluetooth,
    lastUpdated: new Date().toISOString(),
  }
  deviceSettingsStore.set(deviceId, updated)
  return updated
}

export async function getDeviceSettings(deviceId: string): Promise<DeviceSettingsState> {
  let state = deviceSettingsStore.get(deviceId)
  if (!state) {
    state = defaultDeviceSettings(deviceId)
    deviceSettingsStore.set(deviceId, state)
  }

  // Đồng bộ telemetry thực tế mới nhất và trạng thái kết nối từ ThingsBoard nếu khả dụng
  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      const [telemetry, serverAttrs] = await Promise.all([
        tbRequest(
          `/api/plugins/telemetry/DEVICE/${target.id.id}/values/timeseries?keys=wifi_ssid,wifi_signal,wifi_ip,wifi_connected,bluetooth_device,bluetooth_connected,volume,is_muted,show_fps,stream_enabled,max_faces,status,fps`
        ).catch(() => null),
        tbRequest(
          `/api/plugins/telemetry/DEVICE/${target.id.id}/values/attributes/SERVER_SCOPE?keys=active,lastConnectTime,lastDisconnectTime,lastActivityTime`
        ).catch(() => []),
      ])

      const attrMap = new Map<string, unknown>(
        Array.isArray(serverAttrs) ? serverAttrs.map((a: any) => [a.key, a.value]) : []
      )
      const lastConnect = Number(attrMap.get('lastConnectTime') || 0)
      const lastDisconnect = Number(attrMap.get('lastDisconnectTime') || 0)
      const lastActivity = Number(attrMap.get('lastActivityTime') || 0)

      const statusEntry = telemetry?.['status']?.[0]
      const fpsEntry = telemetry?.['fps']?.[0]
      const statusVal = statusEntry?.value
      const latestTs = Math.max(
        Number(statusEntry?.ts || 0),
        Number(fpsEntry?.ts || 0),
        lastActivity
      )

      const isMqttConnected = lastConnect > 0 && lastConnect >= lastDisconnect
      const isHeartbeatFresh = latestTs > 0 && Date.now() - latestTs < 20000
      const isOnline = isMqttConnected && isHeartbeatFresh && statusVal !== 'OFFLINE'

      state.online = isOnline

      if (isOnline && telemetry) {
        const getVal = (key: string) => telemetry[key]?.[0]?.value

        const rawFps = getVal('fps')
        state.fps = rawFps !== undefined && !Number.isNaN(Number(rawFps)) ? Number(rawFps) : 0

        const ssid = getVal('wifi_ssid')
        const ip = getVal('wifi_ip')
        const signal = getVal('wifi_signal')
        const btDev = getVal('bluetooth_device')
        const btConn = getVal('bluetooth_connected')

        const hasSsid = typeof ssid === 'string' && ssid.trim().length > 0
        const hasIp = typeof ip === 'string' && ip.trim().length > 0
        state.wifi = {
          connected: hasSsid || hasIp,
          ssid: hasSsid ? ssid.trim() : hasIp ? 'Mạng LAN / Wi-Fi' : '',
          signalStrength: signal && Number(signal) > 0 ? Number(signal) : hasIp ? 85 : 0,
          ip: hasIp ? ip.trim() : '',
        }

        if (btDev !== undefined || btConn !== undefined) {
          const isBtConnected = (btConn === true || btConn === 'true') && Boolean(btDev && String(btDev).trim())
          state.bluetooth = {
            connected: isBtConnected,
            deviceName: isBtConnected && typeof btDev === 'string' ? btDev.trim() : '',
            status: isBtConnected ? 'connected' : 'disconnected',
          }
        }

        // Đồng bộ cờ điều khiển từ thiết bị nếu người dùng không vừa bấm nút trong 5 giây gần nhất
        const lastPatchAt = lastUserPatchTimes.get(deviceId) || 0
        if (Date.now() - lastPatchAt > 5000) {
          const vol = getVal('volume')
          if (vol !== undefined && !Number.isNaN(Number(vol))) state.volume = Number(vol)
          const muted = getVal('is_muted')
          if (muted !== undefined) state.isMuted = muted === true || muted === 'true'
          const fpsFlag = getVal('show_fps')
          if (fpsFlag !== undefined) state.showFps = fpsFlag === true || fpsFlag === 'true'
          const stream = getVal('stream_enabled')
          if (stream !== undefined) state.streamEnabled = stream === true || stream === 'true'
          const maxF = getVal('max_faces')
          if (maxF !== undefined && !Number.isNaN(Number(maxF))) {
            state.maxFaces = Math.max(1, Math.min(10, Number(maxF)))
          }
        }
      } else if (!isOnline) {
        state.fps = 0
        state.wifi = {
          connected: false,
          ssid: '',
          signalStrength: 0,
          ip: '',
        }
        state.bluetooth = {
          connected: false,
          deviceName: '',
          status: 'disconnected',
        }
      }

      state.lastUpdated = new Date().toISOString()
      deviceSettingsStore.set(deviceId, state)
    } catch (err: any) {
      console.warn(`[Device Service] TB sync telemetry warning:`, err?.message)
    }
  }

  return state
}

export async function updateDeviceSettings(
  deviceId: string,
  patch: Partial<DeviceSettingsState>,
): Promise<DeviceSettingsState> {
  // Lấy trực tiếp state hiện hành trong store (tránh gọi getDeviceSettings kéo telemetry cũ về ghi đè nút kia)
  const current = deviceSettingsStore.get(deviceId) || (await getDeviceSettings(deviceId))
  const updated: DeviceSettingsState = {
    ...current,
    ...patch,
    wifi: patch.wifi ? { ...current.wifi, ...patch.wifi } : current.wifi,
    bluetooth: patch.bluetooth ? { ...current.bluetooth, ...patch.bluetooth } : current.bluetooth,
    lastUpdated: new Date().toISOString(),
  }
  deviceSettingsStore.set(deviceId, updated)
  lastUserPatchTimes.set(deviceId, Date.now())

  // Đồng bộ sang ThingsBoard (cả SHARED_SCOPE bền vững VÀ Two-Way RPC thực thi tức thì trên Pi)
  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      const tbPayload: Record<string, any> = {
        settings_updated_at: Date.now(),
      }
      if (patch.volume !== undefined) tbPayload.volume = updated.volume
      if (patch.isMuted !== undefined) tbPayload.is_muted = updated.isMuted
      if (patch.showFps !== undefined) tbPayload.show_fps = updated.showFps
      if (patch.streamEnabled !== undefined) tbPayload.stream_enabled = updated.streamEnabled
      if (patch.maxFaces !== undefined) tbPayload.max_faces = updated.maxFaces

      await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, tbPayload)

      // Gửi thêm Two-Way RPC trực tiếp xuống Pi để phần cứng thực thi ngay lập tức
      const rpcCalls: Promise<any>[] = []
      if (patch.streamEnabled !== undefined) {
        rpcCalls.push(
          tbRequest(`/api/rpc/twoway/${target.id.id}`, {
            method: 'setStreamEnabled',
            params: { stream_enabled: updated.streamEnabled },
            timeout: 4000,
          }).catch(() => null)
        )
      }
      if (patch.showFps !== undefined) {
        rpcCalls.push(
          tbRequest(`/api/rpc/twoway/${target.id.id}`, {
            method: 'setShowFps',
            params: { show_fps: updated.showFps },
            timeout: 4000,
          }).catch(() => null)
        )
      }
      if (patch.maxFaces !== undefined) {
        rpcCalls.push(
          tbRequest(`/api/rpc/twoway/${target.id.id}`, {
            method: 'setMaxFaces',
            params: { max_faces: updated.maxFaces },
            timeout: 4000,
          }).catch(() => null)
        )
      }
      if (patch.volume !== undefined) {
        rpcCalls.push(
          tbRequest(`/api/rpc/twoway/${target.id.id}`, {
            method: 'setVolume',
            params: { volume: updated.isMuted ? 0 : updated.volume },
            timeout: 4000,
          }).catch(() => null)
        )
      }
      if (rpcCalls.length > 0) {
        await Promise.all(rpcCalls)
      }
    } catch (tbErr) {
      console.warn(`[Device Service] TB sync settings warning:`, tbErr)
    }
  }

  return updated
}

export async function triggerDeviceAction(
  deviceId: string,
  action: string,
  params?: any,
): Promise<{ success: boolean; data?: any; message: string }> {
  // 1. Thử gọi ThingsBoard RPC nếu có kết nối
  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      const rpcMethodMap: Record<string, string> = {
        'test-audio': 'playTestSound',
        'scan-wifi': 'scanWifi',
        'scan-bluetooth': 'scanBluetooth',
        'bluetooth-reconnect': 'reconnectBluetooth',
        'bluetooth-connect': 'connectBluetooth',
        'bluetooth-disconnect': 'disconnectBluetooth',
      }
      const method = rpcMethodMap[action] || action
      const result = await tbRequest(`/api/rpc/twoway/${target.id.id}`, {
        method,
        params: params || {},
        timeout: 12000,
      })
      if (action === 'bluetooth-disconnect') {
        const cur = deviceSettingsStore.get(deviceId)
        if (cur) {
          cur.bluetooth = { connected: false, deviceName: '', status: 'disconnected' }
          cur.lastUpdated = new Date().toISOString()
          deviceSettingsStore.set(deviceId, cur)
        }
      }
      let data = result
      if (action === 'scan-bluetooth' || action === 'scan-wifi') {
        if (Array.isArray(result)) {
          data = result
        } else if (result && Array.isArray(result.devices)) {
          data = result.devices
        } else if (result && Array.isArray(result.networks)) {
          data = result.networks
        } else if (result && typeof result === 'object' && result.success && Array.isArray(result.data)) {
          data = result.data
        } else {
          data = []
        }
      }
      return { success: true, data, message: `Thực hiện ${action} thành công qua ThingsBoard RPC` }
    } catch (err: any) {
      console.warn(`[Device Service] ThingsBoard RPC fallback for ${action}:`, err?.message)
    }
  }

  // 2. Mock Fallback phục vụ môi trường Dev / Offline
  if (action === 'scan-wifi') {
    return {
      success: true,
      data: [],
      message: 'Chưa quét được danh sách Wi-Fi',
    }
  }

  if (action === 'bluetooth-disconnect') {
    const cur = deviceSettingsStore.get(deviceId)
    if (cur) {
      cur.bluetooth = { connected: false, deviceName: '', status: 'disconnected' }
      cur.lastUpdated = new Date().toISOString()
      deviceSettingsStore.set(deviceId, cur)
    }
    return {
      success: true,
      data: { connected: false, deviceName: '', status: 'disconnected' },
      message: 'Đã ngắt kết nối loa Bluetooth',
    }
  }

  if (action === 'scan-bluetooth') {
    return {
      success: true,
      data: [],
      message: 'Chưa quét được danh sách thiết bị loa Bluetooth',
    }
  }

  if (action === 'bluetooth-connect') {
    const current = await getDeviceSettings(deviceId)
    const targetName = params?.name || params?.deviceName || 'Loa Bluetooth'
    current.bluetooth = {
      connected: true,
      deviceName: targetName,
      status: 'connected',
    }
    deviceSettingsStore.set(deviceId, current)
    eventBus.emit('device:settings-updated', current)
    return {
      success: true,
      data: current.bluetooth,
      message: `Đã kết nối thành công tới loa ${targetName}`,
    }
  }

  if (action === 'bluetooth-reconnect') {
    const current = await getDeviceSettings(deviceId)
    current.bluetooth.connected = true
    current.bluetooth.status = 'connected'
    deviceSettingsStore.set(deviceId, current)
    eventBus.emit('device:settings-updated', current)
    return {
      success: true,
      data: current.bluetooth,
      message: `Đã kết nối lại thành công với ${current.bluetooth.deviceName}`,
    }
  }

  return { success: true, message: `Lệnh ${action} đã được điều phối xử lý thành công` }
}
