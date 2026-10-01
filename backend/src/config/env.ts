import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  MQTT_URL: z.string().min(1, 'MQTT_URL is required').default('mqtt://localhost:1883'),
  MQTT_USERNAME: z.string().optional().default(''),
  MQTT_PASSWORD: z.string().optional().default(''),
  MQTT_DEVICE_SECRET: z.string().min(32, 'MQTT_DEVICE_SECRET must be at least 32 characters'),
  BIOMETRIC_ENCRYPTION_KEY: z.string().min(32, 'BIOMETRIC_ENCRYPTION_KEY must be at least 32 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FACE_AUTH_URL: z.string().default('http://localhost:5000'),
  FACE_AUTH_TIMEOUT_MS: z.string().default('30000').transform(Number),
  FACE_AUTH_MODEL_VERSION: z.string().default('buffalo_s'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
