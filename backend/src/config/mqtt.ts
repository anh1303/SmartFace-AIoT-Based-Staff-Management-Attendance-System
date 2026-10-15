import mqtt, { type MqttClient } from 'mqtt'
import { env } from './env.js'
import { logger } from '../common/logger.js'

const mqttLogger = logger.child('MQTT')

let client: MqttClient | undefined
export const getMqttClient = () => client

export function connectMqtt() {
  if (client) return client

  if (env.ENABLE_MQTT !== 'true') {
    mqttLogger.info(
      'Direct MQTT client is disabled (using ThingsBoard Rule Chain Webhook for attendance events). Set ENABLE_MQTT=true in .env to enable.',
    )
    return undefined
  }

  client = mqtt.connect(env.MQTT_URL, {
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 3000,
  })

  // Ghi log đầy đủ lifecycle của kết nối MQTT để dễ dàng giám sát và debug
  client.on('connect', () => {
    mqttLogger.info(`Connected successfully to broker at ${env.MQTT_URL}`)
  })
  client.on('reconnect', () => {
    mqttLogger.warn('Reconnecting to broker...')
  })
  client.on('offline', () => {
    mqttLogger.warn('Client went offline')
  })
  client.on('close', () => {
    mqttLogger.info('Connection closed')
  })
  client.on('error', (error) => {
    mqttLogger.error('Connection error:', error.message)
    if (error.message.includes('Not authorized')) {
      mqttLogger.warn(
        'Broker từ chối xác thực (Not authorized). Đã dừng retry để tránh làm nghẽn hệ thống. Kiểm tra MQTT_USERNAME (Device Token trên ThingsBoard) hoặc đặt ENABLE_MQTT=false.',
      )
      client?.end(true)
      client = undefined
    }
  })

  return client
}

// 14. publishMqtt trả về Promise<void> và xử lý bắt lỗi đầy đủ
export function publishMqtt(topic: string, payload: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!client) {
      return reject(new Error('MQTT client is not connected'))
    }
    client.publish(topic, JSON.stringify(payload), (err) => {
      if (err) {
        mqttLogger.error(`Publish error on topic ${topic}:`, err)
        return reject(err)
      }
      resolve()
    })
  })
}

export function disconnectMqtt(force = false): Promise<void> {
  return new Promise((resolve) => {
    if (!client) {
      resolve()
      return
    }

    const currentClient = client
    client = undefined

    currentClient.end(force, {}, () => {
      resolve()
    })
  })
}