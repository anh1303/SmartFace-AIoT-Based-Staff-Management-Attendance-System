import { expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({
  attendance_logs: { findMany: vi.fn(async () => []) },
  employee_shifts: { findMany: vi.fn(async () => []) },
}));
vi.mock('../../src/config/database.js', () => ({ prisma: db }));
vi.mock('../../src/modules/employees/public.js', () => ({ getEmployeeScope: vi.fn(async () => ({})) }));
import { list } from '../../src/modules/attendance/attendance.service.js';
import { determinePunctuality, formatAttendanceRecord } from '../../src/modules/attendance/attendance.format.js';
it('does not fetch or repeat employee photos for compact history responses', async () => {
  await list({ compact: 'true', limit: 5000 }, { id: 'admin', role: 'ADMIN' });
  expect(db.attendance_logs.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: { employees: { select: expect.objectContaining({ avatar_url: false, employee_code: true, full_name: true }) } } }));
});
it('bounds ordinary pages while preserving explicit complete-range consumers', async () => {
  await list({}, { id: 'admin', role: 'ADMIN' });
  expect(db.attendance_logs.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 50 }));
  await list({ limit: 5000, page: 2 }, { id: 'admin', role: 'ADMIN' });
  expect(db.attendance_logs.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 200, skip: 200 }));
  await list({ limit: 5000, fetchAllPages: 'true' }, { id: 'admin', role: 'ADMIN' });
  expect(db.attendance_logs.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ take: 5000 }));
});
it('filters date queries by stored work_date while including null work_date logs by timestamp and returning work_date without fabricating one from timestamp', async () => {
  const rows = [
    {
      id: 101n,
      employee_id: 'emp-1',
      type: 'CHECK_IN',
      event_time: new Date('2026-11-18T22:00:00+07:00'),
      work_date: new Date('2026-11-18T00:00:00.000Z'),
      status: 'VALID',
      method: 'FACE',
      employees: { id: 'emp-1', employee_code: 'EMP001', full_name: 'Night Worker' },
    },
    {
      id: 102n,
      employee_id: 'emp-1',
      type: 'CHECK_OUT',
      event_time: new Date('2026-11-19T06:10:00+07:00'),
      work_date: new Date('2026-11-18T00:00:00.000Z'),
      status: 'VALID',
      method: 'FACE',
      employees: { id: 'emp-1', employee_code: 'EMP001', full_name: 'Night Worker' },
    },
    {
      id: 103n,
      employee_id: 'emp-1',
      type: 'CHECK_OUT',
      event_time: new Date('2026-11-19T18:00:00+07:00'),
      work_date: new Date('2026-11-19T00:00:00.000Z'),
      status: 'VALID',
      method: 'FACE',
      employees: { id: 'emp-1', employee_code: 'EMP001', full_name: 'Night Worker' },
    },
    {
      id: 104n,
      employee_id: 'emp-1',
      type: 'CHECK_IN',
      event_time: new Date('2026-11-18T12:00:00+07:00'),
      work_date: null,
      status: 'VALID',
      method: 'FACE',
      employees: { id: 'emp-1', employee_code: 'EMP001', full_name: 'Night Worker' },
    },
  ];
  db.attendance_logs.findMany.mockImplementationOnce(async ({ where }: any) => {
    const branches: any[] = where?.OR || [];
    return rows.filter((row) =>
      branches.some((branch) => {
        if (branch.work_date === null) {
          return (
            row.work_date === null &&
            (!branch.event_time?.gte || row.event_time >= branch.event_time.gte) &&
            (!branch.event_time?.lt || row.event_time < branch.event_time.lt)
          );
        }
        if (branch.work_date) {
          return (
            row.work_date !== null &&
            (!branch.work_date.gte || row.work_date >= branch.work_date.gte) &&
            (!branch.work_date.lte || row.work_date <= branch.work_date.lte)
          );
        }
        return false;
      })
    );
  });
  db.employee_shifts.findMany.mockResolvedValueOnce([
    {
      employee_id: 'emp-1',
      work_date: new Date('2026-11-18T00:00:00.000Z'),
      shift_type: 'NIGHT',
      start_time: '22:00',
      end_time: '06:00',
      work_shifts: { start_time: '22:00', end_time: '06:00' },
    },
  ]);

  const result = await list({ startDate: '2026-11-18', endDate: '2026-11-18', compact: 'true' }, { id: 'admin', role: 'ADMIN' });
  expect(result.map((r: any) => ({ id: r.id, work_date: r.work_date }))).toEqual([
    { id: '101', work_date: '2026-11-18' },
    { id: '102', work_date: '2026-11-18' },
    { id: '104', work_date: null },
  ]);
});
it('uses stored workDateOverride in determinePunctuality and formatAttendanceRecord when stored date differs from calendar inference', () => {
  const shifts = [
    { work_date: '2026-11-18', start_time: '22:00', end_time: '06:00', shift_type: 'NIGHT' },
    { work_date: '2026-11-19', start_time: '08:00', end_time: '17:00', shift_type: 'OFFICE_HOURS' },
  ];
  // 2026-11-19 08:30+07:00 would infer work_date '2026-11-19' (EARLY_LEAVE vs 17:00 end) without workDateOverride,
  // but when stored work_date is '2026-11-18' (06:00 end on 19/11), checkout at 08:30 is ON_TIME.
  const eventTime = new Date('2026-11-19T08:30:00+07:00');
  expect(determinePunctuality('CHECK_OUT', eventTime, shifts)).toBe('EARLY_LEAVE');
  expect(determinePunctuality('CHECK_OUT', eventTime, shifts, '2026-11-18')).toBe('ON_TIME');

  const formatted = formatAttendanceRecord(
    {
      id: 200n,
      employee_id: 'emp-1',
      type: 'CHECK_OUT',
      event_time: eventTime,
      work_date: new Date('2026-11-18T00:00:00.000Z'),
      status: 'VALID',
      method: 'FACE',
    } as any,
    shifts
  );
  expect((formatted as any).work_date).toBe('2026-11-18');
  expect(formatted.punctuality).toBe('ON_TIME');
});
