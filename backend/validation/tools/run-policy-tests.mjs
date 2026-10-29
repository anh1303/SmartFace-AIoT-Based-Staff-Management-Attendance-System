import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import net from 'node:net'

const name = `smartface-policy-test-${randomBytes(8).toString('hex')}`
const password = randomBytes(24).toString('hex')
const url = `postgresql://postgres:${password}@127.0.0.1:55439/policy_check`
const env = { ...process.env, DATABASE_URL: url, DIRECT_URL: url, RUN_POLICY_DB_TESTS: '1', RUN_SOCKET_TESTS: '1', NODE_ENV: 'test', JWT_SECRET: 'isolated-policy-test-jwt-secret-32-characters', MQTT_DEVICE_SECRET: 'isolated-policy-test-mqtt-secret-32-characters', BIOMETRIC_ENCRYPTION_KEY: 'isolated-policy-test-biometric-key-32-characters', ENABLE_MQTT: 'false', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', FACE_AUTH_URL: 'http://127.0.0.1:1', TB_HOST: '', LOG_LEVEL: 'error' }
const run = (command, args, options = {}) => spawnSync(command, args, { encoding: 'utf8', ...options })
const portAvailable = await new Promise(resolve => {
  const server = net.createServer()
  server.once('error', () => resolve(false))
  server.listen(55439, '127.0.0.1', () => server.close(() => resolve(true)))
})
if (!portAvailable) throw new Error('Port 127.0.0.1:55439 is in use; no existing database was changed')

let started = false
try {
  const container = run('docker', ['run', '--detach', '--rm', '--name', name, '-p', '127.0.0.1:55439:5432', '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=policy_check', 'pgvector/pgvector:pg18'])
  if (container.status !== 0) throw new Error(`Could not start isolated PostgreSQL: ${container.stderr.trim()}`)
  started = true
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    if (run('docker', ['exec', name, 'pg_isready', '-U', 'postgres', '-d', 'policy_check']).status === 0) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  if (!ready) throw new Error('Isolated PostgreSQL did not become ready')
  for (const args of [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['node_modules/vitest/vitest.mjs', 'run', '--no-file-parallelism']]) {
    const result = run(process.execPath, args, { env, stdio: 'inherit' })
    if (result.status !== 0) throw new Error(`Command failed with exit code ${result.status}`)
  }
} finally {
  if (started) {
    const stopped = run('docker', ['stop', name])
    if (stopped.status !== 0) { console.error(`Could not remove test container ${name}: ${stopped.stderr.trim()}`); process.exitCode = 1 }
  }
}
