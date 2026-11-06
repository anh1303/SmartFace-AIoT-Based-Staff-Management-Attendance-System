import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({
  db: { employee: { findUnique: vi.fn() }, $executeRaw: vi.fn() },
  input: vi.fn(), send: vi.fn(), actor: vi.fn(),
}))
vi.mock('../../src/config/database.js', () => ({ prisma: state.db }))
vi.mock('../../src/modules/operations/operation.service.js', () => ({ stagedInput: state.input }))
vi.mock('../../src/modules/operations/operation.worker.js', () => ({ currentActor: state.actor }))
vi.mock('../../src/common/email.service.js', () => ({ sendAccountCredentialsEmail: state.send }))
vi.mock('../../src/config/env.js', () => ({ env: { SMTP_USER: 'smtp-user', SMTP_PASS: 'configured' } }))
import { executeAccountEmail } from '../../src/modules/employees/employee.jobs.js'
beforeEach(() => {
  vi.clearAllMocks(); state.input.mockResolvedValue({ to: 'an@example.com', passwordHash: 'h1', rawPassword: 'secret' });
  state.db.employee.findUnique.mockResolvedValue({ email: 'an@example.com', users: { passwordHash: 'h1', is_active: true } });
})
it('does not call an email failure a successful job', async () => {
  state.send.mockResolvedValue({ success: false, error: 'smtp unavailable' });
  await expect(executeAccountEmail({ id: 'job1', owner_id: 'u1', payload: { employeeId: 'e1' } } as any)).rejects.toThrow('Chưa gửi được email');
  expect(state.db.$executeRaw).not.toHaveBeenCalled();
})
it('does not email a stale password after the account was reset', async () => {
  state.db.employee.findUnique.mockResolvedValue({ email: 'an@example.com', users: { passwordHash: 'changed', is_active: true } });
  await expect(executeAccountEmail({ id: 'job1', owner_id: 'u1', payload: { employeeId: 'e1' } } as any)).rejects.toThrow('đã thay đổi');
  expect(state.send).not.toHaveBeenCalled();
})
