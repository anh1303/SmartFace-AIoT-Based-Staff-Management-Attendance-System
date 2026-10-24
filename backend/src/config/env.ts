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
  ENABLE_MQTT: z.string().optional().default('false'),
  BIOMETRIC_ENCRYPTION_KEY: z.string().min(32, 'BIOMETRIC_ENCRYPTION_KEY must be at least 32 characters'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  FACE_AUTH_URL: z.string().default('http://localhost:5000'),
  FACE_AUTH_TIMEOUT_MS: z.string().default('30000').transform(Number),
  FACE_AUTH_MODEL_VERSION: z.string().default('buffalo_s'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),

  // SMTP / Email Configuration for automated notifications
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().optional().default('587').transform((val) => Number(val) || 587),
  SMTP_SECURE: z.string().optional().default('false').transform((val) => val === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('"SmartFace AIoT" <no-reply@smartface.aiot>'),
  CLIENT_URL: z.string().optional().default(''),
})


const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
