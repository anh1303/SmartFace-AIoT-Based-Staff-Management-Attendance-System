import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'

// Execute the real seed against an in-memory Prisma boundary, never a database.
function fixture(existingModel?: string) {
  const rows: Record<string, any[]> = {}
  const models = ['roles', 'department', 'position', 'user', 'employee', 'device', 'bonusPenalty', 'work_shifts',
    'attendance_logs', 'daily_attendance_summary', 'payrollRecord', 'auditLog', 'attendance_locks',
    'face_embeddings', 'employee_shifts']
  const db: any = { $executeRawUnsafe: vi.fn(), $executeRaw: vi.fn() }
  for (const model of models) {
    rows[model] = existingModel === model ? [{ id: 99 }] : []
    db[model] = {
      count: async () => rows[model].length,
      findFirst: async () => rows[model][0] ?? null,
      deleteMany: vi.fn(async () => { rows[model] = [] }),
      create: async ({ data }: any) => {
        const row = { id: rows[model].length + 1, ...data }
        rows[model].push(row)
        return row
      },
    }
  }
  db.$transaction = vi.fn(async (callback: any) => callback(db))
  const source = readFileSync(new URL('../../../prisma/seed.ts', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '').split('\nmain()')[0] + '\nreturn main()'
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const run = () => new Function('PrismaClient', 'bcrypt', code)(function () { return db }, { hash: async () => 'hashed' })
  return { db, rows, run }
}

describe('master data seed', () => {
  it('links all 18 employees to positions in their department and assigns manager roles', async () => {
    const { rows, run } = fixture()
    await run()
    expect(rows.position).toHaveLength(18)
    expect(rows.employee).toHaveLength(18)
    for (const employee of rows.employee) {
      const position = rows.position.find(p => p.id === employee.positionId)
      expect(position?.departmentId).toBe(employee.departmentId)
      const user = rows.user.find(u => u.id === employee.user_id)
      const role = rows.roles.find(r => r.id === user.role_id)
      expect(role.role_name).toBe(position.level)
    }
  })

  it.each(['employee', 'department', 'bonusPenalty', 'work_shifts'])('refuses existing %s data before writing or deleting', async model => {
    const { db, rows, run } = fixture(model)
    await expect(run()).rejects.toThrow()
    expect(rows[model]).toEqual([{ id: 99 }])
    expect(rows.roles).toEqual([])
    for (const value of Object.values(db) as any[]) {
      if (value?.deleteMany) expect(value.deleteMany).not.toHaveBeenCalled()
    }
  })

  it('seeds offline hardware, historical wage rates and a policy covering every hire month without operational data', async () => {
    const { db, rows, run } = fixture()
    await run()
    expect(db.$transaction).toHaveBeenCalledOnce()
    expect(rows.device.map(d => d.name)).toEqual(['PI4_FRONT_GATE'])
    expect(rows.device.every(d => d.status === 'OFFLINE' && d.last_seen == null && d.ip == null)).toBe(true)
    for (const employee of rows.employee) {
      const hirePeriod = employee.createdAt.toISOString().slice(0, 7)
      expect(rows.bonusPenalty[0].effective_period <= hirePeriod).toBe(true)
      expect(employee.hourly_rate_history).toEqual([{ period: hirePeriod, rate: employee.hourly_rate }])
      expect(employee.phone).toMatch(/^0\d{9}$/)
    }
    for (const model of ['work_shifts', 'employee_shifts', 'attendance_logs', 'daily_attendance_summary', 'payrollRecord', 'auditLog']) {
      expect(rows[model]).toEqual([])
    }
    expect(db.$executeRawUnsafe).not.toHaveBeenCalled()
  })
})
