import { describe, expect, it, vi } from 'vitest'
import { syncDayAdjustments } from '../../src/modules/attendance/attendance.adjustments.js'

describe('Absence snapshot stability', () => {
  const day = { employee_id: 'emp', work_date: new Date('2026-10-01T00:00:00Z'), overtime_candidate_hours: 0,
    overtime: 0, overtime_status: 'NONE', late_early: 0,
    calculation_details: { absenceCandidate: true, scheduledShiftSeconds: 28800, fingerprint: 'same-attendance', policy: 'v6' } }
  it('preserves an approved absence rate when a later policy changes', async () => {
    let saved: any = null
    const tx: any = {
      attendanceAdjustment: { findUnique: vi.fn(async ({ where }: any) => where.employee_id_work_date_kind.kind === 'ABSENCE' ? saved : null),
        upsert: vi.fn(async ({ create }: any) => { saved = { id: 1n, ...create }; return saved }) },
      auditLog: { create: vi.fn() },
    }
    await syncDayAdjustments(tx, day, 100000, 2)
    saved.status = 'APPROVED'
    await syncDayAdjustments(tx, day, 100000, 4)
    expect(saved).toMatchObject({ amount: 1600000, status: 'APPROVED' })
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })
})
