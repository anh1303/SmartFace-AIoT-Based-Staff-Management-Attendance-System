import { expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ attendance_logs: { findMany: vi.fn(async () => []) } }));
vi.mock('../../src/config/database.js', () => ({ prisma: db }));
vi.mock('../../src/modules/employees/public.js', () => ({ getEmployeeScope: vi.fn(async () => ({})) }));
import { list } from '../../src/modules/attendance/attendance.service.js';
it('does not fetch or repeat employee photos for compact history responses', async () => {
  await list({ compact: 'true', limit: 5000 }, { id: 'admin', role: 'ADMIN' });
  expect(db.attendance_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { employees: { select: expect.objectContaining({ avatar_url: false, employee_code: true, full_name: true }) } } }));
});
