import { beforeEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }))
const employees = vi.hoisted(() => ({ findEmployeeByIdOrCode: vi.fn(), findActiveEmployeeIds: vi.fn() }))
vi.mock('../../src/config/database.js', () => ({ prisma: db }))
vi.mock('../../src/modules/employees/public.js', () => employees)
import { findBestFaceMatch } from '../../src/modules/biometrics/biometric.service.js'
import { env } from '../../src/config/env.js'
const vec = '[' + Array(512).fill('0.04419417').join(',') + ']'
const candidate = { employee_id: 'employee-active', employee_code: 'NV1', full_name: 'An', avatar_url: null, status: 'ACTIVE', embedding_type: 'CENTROID', similarity: .90 }
beforeEach(() => {
  vi.resetAllMocks(); db.$queryRaw.mockResolvedValue([candidate]);
  employees.findActiveEmployeeIds.mockResolvedValue(['employee-active']);
  employees.findEmployeeByIdOrCode.mockResolvedValue({ ...candidate, id: candidate.employee_id });
})
describe('single-query face matching', () => {
  it('can exclude avatars from repeated recognition calls before the device response strips them', async () => {
    await findBestFaceMatch(vec, undefined, { includeAvatar: false });
    const values = db.$queryRaw.mock.calls[0].slice(1);
    expect(values.some((value: any) => value?.sql === 'NULL::text')).toBe(true);
  })
  it('returns identity in one round trip with model, centroid and active filters before LIMIT', async () => {
    expect(await findBestFaceMatch(vec)).toEqual({ emp_id: 'employee-active', employee_code: 'NV1', full_name: 'An', avatar_url: null, embedding_type: 'CENTROID', similarity: .90 });
    expect(db.$queryRaw).toHaveBeenCalledOnce();
    expect(employees.findActiveEmployeeIds).not.toHaveBeenCalled();
    expect(employees.findEmployeeByIdOrCode).not.toHaveBeenCalled();
    const [sql, ...values] = db.$queryRaw.mock.calls[0];
    const statement = sql.join('?');
    expect(statement).toContain('JOIN employees e ON e.id = f.employee_id');
    expect(statement).toContain("e.status = 'ACTIVE'");
    expect(statement).toContain("f.embedding_type = 'CENTROID'");
    expect(statement).toContain('f.model_version = ?');
    expect(values).toContain(env.FACE_AUTH_MODEL_VERSION);
  })
  it('returns null when no active candidate exists', async () => {
    db.$queryRaw.mockResolvedValue([]);
    expect(await findBestFaceMatch(vec)).toBeNull();
  })
  it.each(['INACTIVE', 'TERMINATED'])('rejects an unexpected %s candidate defensively', async status => {
    db.$queryRaw.mockResolvedValue([{ ...candidate, status }]);
    expect(await findBestFaceMatch(vec)).toBeNull();
  })
  it('keeps reads in the transaction supplied by the caller', async () => {
    const tx = { $queryRaw: vi.fn(async () => [candidate]) };
    expect(await findBestFaceMatch(vec, tx as any)).toMatchObject({ emp_id: 'employee-active' });
    expect(tx.$queryRaw).toHaveBeenCalledOnce(); expect(db.$queryRaw).not.toHaveBeenCalled();
  })
})
