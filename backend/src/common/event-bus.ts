import { EventEmitter } from 'node:events'

export interface DomainEvents {
  'fingerprint:progress': { owner_id: string; id: string; employee_id: string; device_id: string; finger_name: string; status: string; match_score: number | null; error: string | null; expires_at: Date }

  'attendance:checked-in': {
    employeeId: string
    logId: string
    eventTime: Date
    type: string
    method: string
    deviceInfo?: string | null
    payload?: any
  }
  'attendance:checked-out': {
    employeeId: string
    logId: string
    eventTime: Date
    type: string
    method: string
    deviceInfo?: string | null
    payload?: any
  }
  'attendance:summary-updated': {
    employeeId?: string
    workDate?: string
    period?: string
    summary: any
  }
  'attendance:spoof-blocked': {
    employeeId?: string
    device_id?: string
    event_id?: string
    similarity?: number
    timestamp: string | Date
    status: string
  }
  'attendance:unknown': {
    device_id?: string
    event_id?: string
    timestamp: string | Date
    status: string
    similarity?: number
  }
  'attendance:flagged': {
    device_id?: string
    event_id?: string
    employee_id?: string
    reason: string
    timestamp: string | Date
  }
  'device:mode-updated': {
    deviceId: string
    mode: string
    confirmed: boolean
  }
  'device:settings-updated': any
  'device:status-changed': {
    deviceId: string
    status: string
    details?: any
  }
  'device:created': any
  'device:updated': any
  'device:deleted': { id: string }
  'audit:logged': {
    userId?: string
    action: string
    targetTable: string
    recordId: string
    oldValues?: any
    newValues?: any
  }
}

/**
 * In-process Typed Domain Event Bus cho Modular Monolith
 * Giúp giao tiếp giữa các module diễn ra qua Domain Events, loại bỏ liên kết chặt (Tight Coupling).
 */
class DomainEventBus extends EventEmitter {
  constructor() {
    super()
    // Tăng giới hạn listeners để nhiều module có thể subscribe
    this.setMaxListeners(50)
  }

  publish<K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): boolean {
    return this.emit(event, payload)
  }

  subscribe<K extends keyof DomainEvents>(
    event: K,
    listener: (payload: DomainEvents[K]) => void | Promise<void>
  ): this {
    return this.on(event, (payload) => {
      try {
        const res = listener(payload)
        if (res && typeof (res as any).catch === 'function') {
          ;(res as Promise<void>).catch((err) => {
            console.error(`[EventBus] Lỗi bất đồng bộ khi xử lý event '${event}':`, err)
          })
        }
      } catch (err) {
        console.error(`[EventBus] Lỗi khi xử lý event '${event}':`, err)
      }
    })
  }
}

export const eventBus = new DomainEventBus()
