import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'

it('keeps biometric binding validation independent of the attendance module', () => {
  const source = readFileSync(resolve('src/modules/biometrics/fingerprint.attendance.ts'), 'utf8')
  expect(source).not.toMatch(/from\s+['"]\.\.\/attendance\//)
})

it('keeps fingerprint log reads independent of the attendance service that dispatches the webhook', () => {
  expect(readFileSync(resolve('src/modules/attendance/attendance.fingerprint.ts'), 'utf8')).not.toMatch(/from\s+['"]\.\/attendance\.service\.js/)
})

it('keeps device routing and biometric services behind public module contracts', () => {
  const files = ['src/modules/devices/device.routes.ts', 'src/modules/biometrics/fingerprint.service.ts', 'src/modules/auth/auth.service.ts']
  for (const file of files) {
    const source = readFileSync(resolve(file), 'utf8')
    expect(source).not.toMatch(/from\s+['"]\.\.\/(?:devices\/device\.service|employees\/employee\.code|biometrics\/fingerprint\.routes)\.js/)
  }
})

it('uses the operations public contract from other modules', () => {
  const files = ['employees/employee.controller.ts', 'employees/employee.jobs.ts', 'employees/employee.service.ts', 'biometrics/biometric.jobs.ts', 'biometrics/biometric.service.ts', 'shifts/shift-batch.service.ts']
  for (const file of files) {
    expect(readFileSync(resolve('src/modules', file), 'utf8')).not.toMatch(/from\s+['"]\.\.\/operations\/operation\./)
  }
})

it('injects employee and account lookups into operations at the composition root', () => {
  for (const file of ['operation.gateway.ts', 'operation.worker.ts']) {
    expect(readFileSync(resolve('src/modules/operations', file), 'utf8')).not.toMatch(/from\s+['"]\.\.\/(?:employees|auth)\//)
  }
})

it('does not bind shift mutations directly to the attendance module', () => {
  const source = readFileSync(resolve('src/modules/shifts/shift.service.ts'), 'utf8')
  expect(source).not.toMatch(/from\s+['"]\.\.\/attendance\//)
})

it('does not bind employee mutations directly to other domain modules', () => {
  const source = readFileSync(resolve('src/modules/employees/employee.service.ts'), 'utf8')
  expect(source).not.toMatch(/from\s+['"]\.\.\/(?:attendance|payroll|shifts|auth|biometrics)\//)
})

it('does not bind authentication services directly to biometric implementations', () => {
  for (const file of ['auth.service.ts', 'face-login/face-login.service.ts']) {
    expect(readFileSync(resolve('src/modules/auth', file), 'utf8')).not.toMatch(/from\s+['"]\.\.\/(?:\.\.\/)?biometrics\//)
  }
})

it('does not bind attendance services directly to payroll implementations', () => {
  for (const file of ['attendance.service.ts', 'attendance.aggregation.ts']) {
    expect(readFileSync(resolve('src/modules/attendance', file), 'utf8')).not.toMatch(/from\s+['"]\.\.\/payroll\//)
  }
})
