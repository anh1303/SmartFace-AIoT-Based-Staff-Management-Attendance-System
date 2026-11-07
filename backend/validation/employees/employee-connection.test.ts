import { beforeEach, expect, it, vi } from 'vitest'
const findFirst = vi.hoisted(() => vi.fn())
vi.mock('../../src/config/database.js', () => ({ prisma: { employee: { findFirst } } }))
vi.mock('../../src/modules/employees/employee.model.js', () => ({ employeeInclude: {} }))
import { findEmployeeByIdOrCode } from '../../src/modules/employees/employee.queries.js'
beforeEach(() => { findFirst.mockReset() })
it('retries a closed connection once for a read outside a transaction', async () => {
  findFirst.mockRejectedValueOnce({ code: 'P1017' }).mockResolvedValueOnce({ id: 'a' })
  expect(await findEmployeeByIdOrCode('a')).toEqual({ id: 'a' })
  expect(findFirst).toHaveBeenCalledTimes(2)
})
it('does not retry a failed transaction read', async () => {
  const failure = { code: 'P1017' }
  const transactionRead = vi.fn().mockRejectedValue(failure)
  await expect(findEmployeeByIdOrCode('a', { employee: { findFirst: transactionRead } } as any)).rejects.toBe(failure)
  expect(transactionRead).toHaveBeenCalledOnce()
  expect(findFirst).not.toHaveBeenCalled()
})
it('bounds retries and preserves other errors', async () => {
  const failure = { code: 'P1017' }
  findFirst.mockRejectedValue(failure)
  await expect(findEmployeeByIdOrCode('a')).rejects.toBe(failure)
  expect(findFirst).toHaveBeenCalledTimes(2)
  findFirst.mockReset().mockRejectedValue({ code: 'P2002' })
  await expect(findEmployeeByIdOrCode('a')).rejects.toMatchObject({ code: 'P2002' })
  expect(findFirst).toHaveBeenCalledOnce()
})
