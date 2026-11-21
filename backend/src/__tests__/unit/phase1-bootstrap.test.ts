import { describe, expect, it, vi } from 'vitest'
import { validateEnvInput } from '../../config/env.js'
import { startBackgroundServices } from '../../server.js'

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
  MQTT_DEVICE_SECRET: 'b'.repeat(32),
  BIOMETRIC_ENCRYPTION_KEY: 'c'.repeat(32),
}

describe('Phase 1 bootstrap & ENABLE_ATTENDANCE_CRON contract', () => {
  it('parses ENABLE_ATTENDANCE_CRON explicitly with backward-compatible true default', () => {
    const defaultParsed = validateEnvInput(baseEnv)
    expect(defaultParsed.success).toBe(true)
    if (defaultParsed.success) {
      expect(defaultParsed.data.ENABLE_ATTENDANCE_CRON).toBe(true)
    }

    const phase1Parsed = validateEnvInput({
      ...baseEnv,
      NODE_ENV: 'production',
      ENABLE_MQTT: 'false',
      ENABLE_ATTENDANCE_CRON: 'false',
      TB_HOST: '',
      TB_WEBHOOK_SECRET: '',
    })
    expect(phase1Parsed.success).toBe(true)
    if (phase1Parsed.success) {
      expect(phase1Parsed.data.ENABLE_ATTENDANCE_CRON).toBe(false)
    }

    const invalidCronFlag = validateEnvInput({
      ...baseEnv,
      ENABLE_ATTENDANCE_CRON: 'maybe',
    })
    expect(invalidCronFlag.success).toBe(false)
  })

  it('skips startAttendanceCron in Phase 1 mode while keeping web operation worker active', () => {
    const startOperationWorkerFn = vi.fn()
    const connectMqttFn = vi.fn().mockReturnValue(undefined)
    const registerDeviceMqttHandlersFn = vi.fn()
    const startAttendanceCronFn = vi.fn()

    startBackgroundServices({
      enableAttendanceCron: false,
      startOperationWorkerFn,
      connectMqttFn,
      registerDeviceMqttHandlersFn,
      startAttendanceCronFn,
    })

    expect(startOperationWorkerFn).toHaveBeenCalledTimes(1)
    expect(startAttendanceCronFn).not.toHaveBeenCalled()
    expect(connectMqttFn).toHaveBeenCalledTimes(1)
    expect(registerDeviceMqttHandlersFn).toHaveBeenCalledTimes(1)
  })

  it('starts attendance cron when enableAttendanceCron is true', () => {
    const startOperationWorkerFn = vi.fn()
    const connectMqttFn = vi.fn().mockReturnValue(undefined)
    const registerDeviceMqttHandlersFn = vi.fn()
    const startAttendanceCronFn = vi.fn()

    startBackgroundServices({
      enableAttendanceCron: true,
      startOperationWorkerFn,
      connectMqttFn,
      registerDeviceMqttHandlersFn,
      startAttendanceCronFn,
    })

    expect(startOperationWorkerFn).toHaveBeenCalledTimes(1)
    expect(startAttendanceCronFn).toHaveBeenCalledTimes(1)
  })
})
