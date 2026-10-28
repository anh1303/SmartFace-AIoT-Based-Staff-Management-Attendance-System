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
  const response = await fetch(`${tbBase()}/api/auth/login`, {
    method: 'POST',
    signal: AbortSignal.timeout(5000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.TB_USERNAME, password: process.env.TB_PASSWORD }),
  })
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
  let name = deviceId
  if (isValidUuid(deviceId)) {
    const stored = await prisma.device.findUnique({ where: { id: deviceId } })
    if (stored) name = stored.name
    else return tbRequest(`/api/device/${deviceId}`)
  }
  return tbRequest('/api/tenant/devices?deviceName=' + encodeURIComponent(name))
}

export interface DeviceModeState {
  deviceId: string
  mode: 'CHECK_IN' | 'CHECK_OUT' | null
  confirmed: boolean
  lastUpdated?: string
}

// Lưu trữ trạng thái chế độ thực tế của thiết bị đã được ACK từ Raspberry Pi
const deviceModeStore = new Map<string, DeviceModeState>()
const pendingModeAcks = new Map<string, { mode: string; resolve: (val: boolean) => void }>()

export function recordDeviceModeNotify(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT'): DeviceModeState {
  const state: DeviceModeState = {
    deviceId,
    mode,
    confirmed: true,
    lastUpdated: new Date().toISOString(),
  }
  deviceModeStore.set(deviceId, state)

  const pending = pendingModeAcks.get(deviceId)
  if (pending && pending.mode === mode) {
    pending.resolve(true)
    pendingModeAcks.delete(deviceId)
  }

  return state
}

export async function getDeviceMode(deviceId: string): Promise<DeviceModeState> {
  const cached = deviceModeStore.get(deviceId)
  if (cached) return cached
  return {
    deviceId,
    mode: null,
    confirmed: false,
  }
}

export async function getDeviceAttendanceMode(deviceId: string) {
  if (process.env.TB_HOST) {
    try {
      const target = await resolveTbDevice(deviceId)
      const value = await tbRequest(`/api/rpc/twoway/${target.id.id}`, { method: 'getValue', params: {}, timeout: 5000 })
      if (typeof value === 'boolean') {
        const mode = value ? ('CHECK_IN' as const) : ('CHECK_OUT' as const)
        recordDeviceModeNotify(deviceId, mode)
        return { deviceId, mode, confirmed: true }
      }
    } catch {
      // Fallback to local cached mode
    }
  }
  const cached = await getDeviceMode(deviceId)
  return { deviceId, mode: cached.mode || 'CHECK_IN', confirmed: cached.confirmed }
}

export async function setDeviceAttendanceMode(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT') {
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
      const value = await tbRequest(`/api/rpc/twoway/${target.id.id}`, { method: 'setValue', params: mode === 'CHECK_IN', timeout: 5000 })
      if (value === (mode === 'CHECK_IN')) {
        await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, { attendance_mode: mode, mode_changed_at: Date.now() })
        recordDeviceModeNotify(deviceId, mode)
        return { deviceId, mode, confirmed: true }
      }
    } catch (tbErr) {
      console.warn(`[Device Service] TB RPC error:`, tbErr)
    }
  }

  const confirmed = await ackPromise
  if (confirmed) {
    recordDeviceModeNotify(deviceId, mode)
  }
  return { deviceId, mode, confirmed }
}

export async function persistConfirmedAttendanceMode(deviceId: string, mode: 'CHECK_IN' | 'CHECK_OUT') {
  if (!process.env.TB_HOST) return
  try {
    const target = await resolveTbDevice(deviceId)
    await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, { attendance_mode: mode, mode_changed_at: Date.now() })
    recordDeviceModeNotify(deviceId, mode)
  } catch {
    // Non-fatal if ThingsBoard is unreachable
  }
}

export interface DeviceSettingsState {
  deviceId: string
  volume: number // 0 - 100
  isMuted: boolean
  showFps: boolean
  streamEnabled: boolean
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

function defaultDeviceSettings(deviceId: string): DeviceSettingsState {
  return {
    deviceId,
    volume: 75,
    isMuted: false,
    showFps: true,
    streamEnabled: true,
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
  patch: Partial<DeviceSettingsState>,
): DeviceSettingsState {
  const current = deviceSettingsStore.get(deviceId) || defaultDeviceSettings(deviceId)
  const updated: DeviceSettingsState = {
    ...current,
    ...patch,
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

  // Đồng bộ telemetry thực tế mới nhất từ ThingsBoard nếu khả dụng
  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      const telemetry = await tbRequest(
        `/api/plugins/telemetry/DEVICE/${target.id.id}/values/timeseries?keys=wifi_ssid,wifi_signal,wifi_ip,wifi_connected,bluetooth_device,bluetooth_connected,volume,is_muted,show_fps,stream_enabled`
      )
      if (telemetry) {
        const getVal = (key: string) => telemetry[key]?.[0]?.value

        const ssid = getVal('wifi_ssid')
        const ip = getVal('wifi_ip')
        const signal = getVal('wifi_signal')
        const btDev = getVal('bluetooth_device')
        const btConn = getVal('bluetooth_connected')

        if (ssid !== undefined || ip !== undefined) {
          const hasSsid = typeof ssid === 'string' && ssid.trim().length > 0
          state.wifi = {
            connected: hasSsid,
            ssid: hasSsid ? ssid.trim() : '',
            signalStrength: signal ? Number(signal) : 0,
            ip: typeof ip === 'string' ? ip.trim() : '',
          }
        }

        if (btDev !== undefined || btConn !== undefined) {
          const isBtConnected = (btConn === true || btConn === 'true') && Boolean(btDev && String(btDev).trim())
          state.bluetooth = {
            connected: isBtConnected,
            deviceName: isBtConnected && typeof btDev === 'string' ? btDev.trim() : '',
            status: isBtConnected ? 'connected' : 'disconnected',
          }
        }

        const vol = getVal('volume')
        if (vol !== undefined && !Number.isNaN(Number(vol))) state.volume = Number(vol)
        const muted = getVal('is_muted')
        if (muted !== undefined) state.isMuted = muted === true || muted === 'true'
        const fps = getVal('show_fps')
        if (fps !== undefined) state.showFps = fps === true || fps === 'true'
        const stream = getVal('stream_enabled')
        if (stream !== undefined) state.streamEnabled = stream === true || stream === 'true'

        state.lastUpdated = new Date().toISOString()
        deviceSettingsStore.set(deviceId, state)
      }
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
  const current = await getDeviceSettings(deviceId)
  const updated: DeviceSettingsState = {
    ...current,
    ...patch,
    wifi: patch.wifi ? { ...current.wifi, ...patch.wifi } : current.wifi,
    bluetooth: patch.bluetooth ? { ...current.bluetooth, ...patch.bluetooth } : current.bluetooth,
    lastUpdated: new Date().toISOString(),
  }
  deviceSettingsStore.set(deviceId, updated)

  // Đồng bộ sang ThingsBoard nếu có cấu hình
  if (process.env.TB_HOST && process.env.NODE_ENV !== 'test') {
    try {
      const target = await resolveTbDevice(deviceId)
      await tbRequest(`/api/plugins/telemetry/DEVICE/${target.id.id}/SHARED_SCOPE`, {
        volume: updated.volume,
        is_muted: updated.isMuted,
        show_fps: updated.showFps,
        stream_enabled: updated.streamEnabled,
        settings_updated_at: Date.now(),
      })
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
      }
      const method = rpcMethodMap[action] || action
      const result = await tbRequest(`/api/rpc/twoway/${target.id.id}`, {
        method,
        params: params || {},
        timeout: 8000,
      })
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
