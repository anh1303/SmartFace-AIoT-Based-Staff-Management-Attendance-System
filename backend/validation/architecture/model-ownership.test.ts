import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

it('keeps module-owned Prisma models behind their public contracts', () => {
  const owners: Record<string, string> = {
    employee_shifts: 'shifts', work_shifts: 'shifts', shiftTemplate: 'shifts',
    attendance_logs: 'attendance', daily_attendance_summary: 'attendance', attendance_locks: 'attendance',
    attendanceAdjustment: 'attendance', attendanceAggregationState: 'attendance', attendanceAlertCheckpoint: 'attendance', webhookAlertDedup: 'attendance',
    payrollRecord: 'payroll', bonusPenalty: 'payroll', payrollRateRepairArchive: 'payroll',
    employee: 'employees', department: 'employees', position: 'employees',
    user: 'auth', roles: 'auth', device: 'devices', face_embeddings: 'biometrics',
  }
  const root = path.resolve('src/modules')
  const violations: string[] = []
  function walk(dir: string, module: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) { walk(file, module); continue }
      if (!item.name.endsWith('.ts')) continue
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      function visit(node: ts.Node) {
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && ['prisma', 'tx', 'client'].includes(node.expression.text)) {
          const model = node.name.text
          if (owners[model] && owners[model] !== module) violations.push(`${path.relative(root, file)}: ${model} belongs to ${owners[model]}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  for (const item of readdirSync(root, { withFileTypes: true })) if (item.isDirectory()) walk(path.join(root, item.name), item.name)
  expect(violations).toEqual([])
})
