import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  $executeRaw: vi.fn(async () => 1),
  $transaction: vi.fn(),
  employee: { findFirst: vi.fn(), update: vi.fn() },
  department: { findFirst: vi.fn() },
  position: { findFirst: vi.fn(), findUnique: vi.fn() },
  auditLog: { create: vi.fn(async () => ({})) },
}))

vi.mock('../../src/config/database.js', () => ({ prisma: db }))

const mockUpdateAuthUser = vi.hoisted(() => vi.fn())
vi.mock('../../src/modules/auth/public.js', () => ({
  updateAuthUser: mockUpdateAuthUser,
}))

import { update } from '../../src/modules/employees/employee.service.js'

describe('Employee and Auth User status atomic synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.$transaction.mockImplementation(async (cb: any) => cb(db))
    mockUpdateAuthUser.mockResolvedValue({})
    db.employee.findFirst.mockResolvedValue({
      id: 'emp-1',
      employee_code: 'NV01',
      user_id: 'user-1',
      full_name: 'Nguyen Van A',
      status: 'ACTIVE',
      hourly_rate: 50000,
    })
    db.employee.update.mockResolvedValue({
      id: 'emp-1',
      employee_code: 'NV01',
      user_id: 'user-1',
      full_name: 'Nguyen Van A',
      status: 'INACTIVE',
      hourly_rate: 50000,
    })
  })

  it('updates both employee status and auth user is_active in the same transaction client', async () => {
    const res = await update('emp-1', { status: 'INACTIVE' }, 'admin-user')

    expect(db.employee.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'emp-1' },
      data: expect.objectContaining({ status: 'INACTIVE' }),
    }))
    expect(mockUpdateAuthUser).toHaveBeenCalledWith('user-1', { is_active: false }, db)
  })

  it('does NOT swallow errors from updateAuthUser and propagates failure to rollback', async () => {
    mockUpdateAuthUser.mockRejectedValueOnce(new Error('Auth service connection failed'))

    await expect(
      update('emp-1', { status: 'ACTIVE' }, 'admin-user')
    ).rejects.toThrow('Auth service connection failed')
  })
})
