import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { assertIsolatedNeonTestDatabase } from '../../src/__tests__/helpers/cloud-test-db.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const settings = dotenv.parse(readFileSync(path.join(root, '.env.testing')))
const source = new URL(settings.DIRECT_URL)
if (source.protocol !== 'postgresql:' || source.hostname !== 'ep-round-breeze-b3p8jbri.c-4.ap-southeast-1.aws.neon.tech' ||
    source.pathname !== '/neondb' || source.searchParams.get('sslmode') !== 'require' || source.searchParams.get('channel_binding') !== 'require') {
  throw new Error('The configured Neon testing endpoint is not recognised')
}
const database = `smartface_test_${randomBytes(8).toString('hex')}`
const testUrl = new URL(source)
testUrl.pathname = `/${database}`
const env = { ...process.env, DATABASE_URL: testUrl.toString(), DIRECT_URL: testUrl.toString(), NODE_ENV: 'test', RUN_POLICY_DB_TESTS: '1', RUN_SOCKET_TESTS: '1',
  JWT_SECRET: 'isolated-neon-test-secret-at-least-32-characters', MQTT_DEVICE_SECRET: 'isolated-neon-mqtt-secret-at-least-32-characters',
  BIOMETRIC_ENCRYPTION_KEY: 'isolated-neon-biometric-key-at-least-32-characters', ENABLE_MQTT: 'false', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
  FACE_AUTH_URL: 'http://127.0.0.1:1', TB_HOST: '', LOG_LEVEL: 'silent' }
assertIsolatedNeonTestDatabase(env.DATABASE_URL, env.DIRECT_URL)
const output = path.join(root, 'tmp/neon-test-results', database)
mkdirSync(output, { recursive: true })
const files = process.argv.slice(2)
const suites = files.length ? files : [
  'validation/payroll/policy-storage.integration.test.ts',
  'validation/attendance/attendance.integration.test.ts',
  'validation/payroll/adjustments.integration.test.ts',
  'validation/attendance/attendance.safety.integration.test.ts',
  'validation/integration/business-rules.integration.test.ts',
  'validation/integration/ui-extension.integration.test.ts',
  'src/__tests__/integration/employee-account-creation.test.ts',
  'validation/auth/socket-auth.test.ts',
]
const admin = new PrismaClient({ datasources: { db: { url: settings.DIRECT_URL } }, log: [] })
let created = false
let failures = 0
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${database}"`)
  created = true
  for (const [index, file] of suites.entries()) {
    assertIsolatedNeonTestDatabase(env.DATABASE_URL, env.DIRECT_URL)
    const migrate = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'],
      { cwd: root, env, encoding: 'utf8', timeout: 300000 })
    writeFileSync(path.join(output, `migration-${index}.log`), String(migrate.stdout ?? '') + String(migrate.stderr ?? ''))
    if (migrate.status !== 0) throw new Error(`Migration failed in the temporary DB; see migration-${index}.log`)
    const db = new PrismaClient({ datasources: { db: { url: testUrl.toString() } }, log: [] })
    try {
      await db.$executeRawUnsafe("INSERT INTO roles(role_name) VALUES ('ADMIN'),('MANAGER'),('EMPLOYEE') ON CONFLICT DO NOTHING")
    } finally { await db.$disconnect() }
    const report = path.join(output, `suite-${index}.json`)
    const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', file, '--no-file-parallelism', '--testTimeout=120000', '--hookTimeout=120000', '--reporter=json', `--outputFile=${report}`],
      { cwd: root, env, encoding: 'utf8', timeout: 300000 })
    writeFileSync(path.join(output, `suite-${index}.log`), String(result.stdout ?? '') + String(result.stderr ?? ''))
    let data
    try { data = JSON.parse(readFileSync(report, 'utf8')) } catch { throw new Error(`No test report for ${file}`) }
    const failed = data.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName))
    console.log(JSON.stringify({ file, passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests, failures: failed }))
    if (result.status !== 0 || data.numFailedTests || data.numPendingTests) failures++
  }
} finally {
  try {
    if (created) {
      assertIsolatedNeonTestDatabase(testUrl.toString(), testUrl.toString())
      await admin.$executeRawUnsafe(`DROP DATABASE "${database}" WITH (FORCE)`)
      console.log('Temporary Neon test database removed.')
    }
  } finally { await admin.$disconnect() }
}
if (failures) process.exitCode = 1
