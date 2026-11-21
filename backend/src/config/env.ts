import { z } from 'zod'
import 'dotenv/config'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
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
  FACE_AUTH_INTERNAL_KEY: z.string().default(''),
  FACE_LOGIN_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  REMOTE_RECOGNITION_ENABLED: z.enum(['true', 'false']).optional().default('false').transform(value => value === 'true'),
  EDGE_RECOGNITION_KEYS: z.string().optional().default('{}'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),

  // Background worker & cron intervals (defaults allow Neon compute to scale to zero when idle)
  ENABLE_ATTENDANCE_CRON: z.enum(['true', 'false']).optional().default('true').transform(value => value === 'true'),
  OPERATION_RECOVERY_INTERVAL_MS: z.coerce.number().int().min(1000).max(86_400_000).default(900_000),
  ATTENDANCE_ALERTS_INTERVAL_MS: z.coerce.number().int().min(60_000).max(3_600_000).default(900_000),

  // ThingsBoard IoT Gateway Configuration (cấu hình qua .env, không để default nhạy cảm)
  TB_HOST: z.string().optional().default(''),
  TB_HTTP_PORT: z.string().optional().default('8080'),
  TB_DEVICE_TOKEN: z.string().optional().default(''),
  TB_DEVICE_UUID: z.string().optional().default(''),
  TB_USERNAME: z.string().optional().default(''),
  TB_PASSWORD: z.string().optional().default(''),
  TB_WEBHOOK_SECRET: z.string().optional().default(''),
  FACE_MATCH_THRESHOLD: z.string().optional().default('0.45').transform(Number),
  ATTENDANCE_MIN_EVENT_INTERVAL_SECONDS: z.coerce.number().int().min(1).max(1800).default(600),

  // SMTP / Email Configuration for automated notifications
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().optional().default('587').transform((val) => Number(val) || 587),
  SMTP_SECURE: z.string().optional().default('false').transform((val) => val === 'true'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default('"SmartFace AIoT" <no-reply@smartface.aiot>'),
  CLIENT_URL: z.string().optional().default(''),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === 'production' && data.TB_HOST.trim() !== '' && data.TB_WEBHOOK_SECRET.length < 24) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['TB_WEBHOOK_SECRET'],
      message: 'TB_WEBHOOK_SECRET must be at least 24 characters when TB_HOST is configured in production',
    })
  }
})

export function validateEnvInput(input: Record<string, unknown>) {
  return envSchema.safeParse(input)
}

const parsed = validateEnvInput(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
