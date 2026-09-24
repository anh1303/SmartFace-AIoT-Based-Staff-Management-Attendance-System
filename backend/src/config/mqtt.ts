import mqtt, { type MqttClient } from 'mqtt'
import { env } from './env.js'

let client: MqttClient | undefined
export const getMqttClient = () => client
export function connectMqtt() {
  if (client || !env.MQTT_URL) return client
  client = mqtt.connect(env.MQTT_URL, { username: env.MQTT_USERNAME || undefined, password: env.MQTT_PASSWORD || undefined, reconnectPeriod: 3000 })
  client.on('error', (error) => console.error('MQTT error:', error.message))
  return client
}
export const publishMqtt = (topic: string, payload: unknown) => client?.publish(topic, JSON.stringify(payload))