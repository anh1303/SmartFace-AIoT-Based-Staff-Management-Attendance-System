import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'

function databaseAliases(source: ts.SourceFile): Set<string> {
  const names = new Set(['prisma', 'tx', 'client'])
  function visit(node: ts.Node) {
    if (ts.isImportSpecifier(node) && node.propertyName?.text === 'prisma') names.add(node.name.text)
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isIdentifier(node.initializer) && names.has(node.initializer.text)) names.add(node.name.text)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === '$transaction') {
      const callback = node.arguments[0]
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        const argument = callback.parameters[0]?.name
        if (argument && ts.isIdentifier(argument)) names.add(argument.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

it('recognizes database aliases and transaction callback clients', () => {
  const source = ts.createSourceFile('example.ts', "import { prisma as db } from './database.js'; const repository = db; db.$transaction(async store => store.employee.findMany());", ts.ScriptTarget.Latest, true)
  expect([...databaseAliases(source)]).toEqual(expect.arrayContaining(['db', 'repository', 'store']))
})

it('keeps module-owned Prisma models behind their public contracts', () => {
  const owners: Record<string, string> = {
    employee_shifts: 'shifts', work_shifts: 'shifts', shiftTemplate: 'shifts',
    attendance_logs: 'attendance', daily_attendance_summary: 'attendance', attendance_locks: 'attendance',
    attendanceAdjustment: 'attendance', attendanceAggregationState: 'attendance', attendanceAlertCheckpoint: 'attendance', webhookAlertDedup: 'attendance',
    payrollRecord: 'payroll', bonusPenalty: 'payroll', payrollRateRepairArchive: 'payroll',
    employee: 'employees', department: 'employees', position: 'employees',
    user: 'auth', roles: 'auth', device: 'devices', face_embeddings: 'biometrics',
    fingerprintTemplate: 'biometrics', fingerprintBinding: 'biometrics', fingerprintSession: 'biometrics', fingerprintDevice: 'biometrics',
  }
  const root = path.resolve('src/modules')
  const violations: string[] = []
  function walk(dir: string, module: string) {
    for (const item of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) { walk(file, module); continue }
      if (!item.name.endsWith('.ts')) continue
      const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
      const aliases = databaseAliases(source)
      function visit(node: ts.Node) {
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && aliases.has(node.expression.text)) {
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
