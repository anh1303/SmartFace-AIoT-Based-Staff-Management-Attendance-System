import { beforeEach, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), user: { findUnique: vi.fn() }, employee: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() } }))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
import { readAuthUser } from '../../src/modules/auth/auth.read.js'
import { verifyAndLoadActiveUser } from '../../src/modules/auth/auth.service.js'
import { env } from '../../src/config/env.js'
import { getEmployeeScope } from '../../src/modules/employees/employee.permission.js'
import { findEmployeeByIdOrCode, findEmployeeWageProfile, findEmployeeWithRelations, findEmployeesWithFilter } from '../../src/modules/employees/employee.queries.js'

beforeEach(() => vi.clearAllMocks())

it('reads only auth fields, including JSON auth metadata instead of the profile avatar', async () => {
  db.$queryRaw.mockResolvedValue([{ id: 'u', username: 'staff', is_active: true,
    profile: { token_version: 2, display_name: 'Display' }, roles: { role_name: 'EMPLOYEE' },
    employees: { id: 'e', employee_code: 'E1', full_name: 'Name', email: null, status: 'ACTIVE', position: null, department: null } }])
  const user = await readAuthUser('u')
  const [sql, ...params] = db.$queryRaw.mock.calls[0]
  const query = sql.join('?')
  expect(query).not.toMatch(/avatar|password_hash|hourly_rate|SELECT\s+\*/i)
  expect(query).toContain("'token_version'")
  expect(query).toContain("'password_changed_at'")
  expect(query).not.toMatch(/u\.profile\s*(?:,|AS)/i)
  expect(params).toEqual(['u'])
  expect(user?.employees?.employee_code).toBe('E1')
  const token = jwt.sign({ id: 'u', tv: 1, amr: ['pwd'] }, env.JWT_SECRET)
  await expect(verifyAndLoadActiveUser(token)).rejects.toMatchObject({ statusCode: 401 })
  db.$queryRaw.mockResolvedValue([])
  expect(await readAuthUser('missing')).toBeNull()
})

it('limits scope reads to employee identifiers and manager classification fields', async () => {
  db.employee.findFirst.mockResolvedValue({ id: 'self', departmentId: 1 })
  db.employee.findMany.mockResolvedValue([{ id: 'staff', position: { name: 'Staff' } }, { id: 'boss', position: { level: 'MANAGER' } }])
  expect(await getEmployeeScope({ id: 'u', role: 'MANAGER' })).toEqual({ id: { in: ['staff', 'self'] } })
  expect(db.employee.findFirst).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true, departmentId: true } }))
  const { select, include } = db.employee.findMany.mock.calls[0][0]
  expect(include).toBeUndefined()
  expect(select).toEqual({ id: true, position: { select: { name: true, level: true } }, department: { select: { name: true } }, users: { select: { roles: { select: { role_name: true } } } } })
})

it('uses an identity-only employee lookup for attendance routing, without changing profile reads', async () => {
  db.employee.findFirst.mockResolvedValue({ id: 'e', status: 'ACTIVE' })
  await findEmployeeByIdOrCode('E1', undefined, 'identity')
  const light = db.employee.findFirst.mock.calls[0][0]
  expect(light.include).toBeUndefined()
  expect(light.select).toMatchObject({ id: true, employee_code: true, user_id: true, status: true })
  expect(light.select).not.toHaveProperty('avatar_url')
  expect(light.select).not.toHaveProperty('hourly_rate_history')
  await findEmployeeByIdOrCode('E1')
  expect(db.employee.findFirst.mock.calls[1][0].include).toHaveProperty('face_embeddings')
})

it('does not read photos or account profiles for wage, aggregation and locked-scan notification reads', async () => {
  await findEmployeeWageProfile('e')
  const wage = db.employee.findFirst.mock.calls[0][0]
  expect(wage.select).toMatchObject({ status: true, hourly_rate: true, hourly_rate_history: true })
  expect(wage.select).not.toHaveProperty('avatar_url')
  await findEmployeesWithFilter({ status: 'ACTIVE' })
  await findEmployeesWithFilter({}, { includeUsersAndRoles: true })
  for (const [args] of db.employee.findMany.mock.calls) {
    expect(args.select).toMatchObject({ id: true, hourly_rate_history: true, createdAt: true })
    expect(args.select).not.toHaveProperty('avatar_url')
    expect(args.include).toBeUndefined()
    if (args.select.users) expect(args.select.users.select).not.toHaveProperty('profile')
  }
  await findEmployeeWithRelations('e')
  expect(db.employee.findUnique.mock.calls[0][0].select).not.toHaveProperty('avatar_url')
})
