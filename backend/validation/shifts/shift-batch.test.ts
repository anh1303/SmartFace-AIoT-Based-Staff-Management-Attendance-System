import { expect, it } from 'vitest'
import { batchRequestSchema, copyWeekSchema } from '../../src/modules/shifts/shift-batch.service.js'
it('requires a target version for each assignment to prevent silent overwrites', () => {
  expect(batchRequestSchema.safeParse({ assignments: [{ employee_id: 'NV1', date: '2026-12-07', shift_type: 'MORNING' }] }).success).toBe(false)
  expect(batchRequestSchema.safeParse({ assignments: [{ employee_id: 'NV1', date: '2026-12-07', shift_type: 'MORNING', expectedVersion: null }] }).success).toBe(true)
})
it('rejects a copy from the wrong source week and duplicate bulk cells', () => {
  expect(copyWeekSchema.safeParse({ sourceMonday: '2026-11-30', targetMonday: '2026-12-07', employeeIds: ['NV1'], expectedTargetVersions: {} }).success).toBe(true)
  expect(copyWeekSchema.safeParse({ sourceMonday: '2026-11-23', targetMonday: '2026-12-07', employeeIds: ['NV1'], expectedTargetVersions: {} }).success).toBe(false)
  const cell = { employee_id: 'NV1', date: '2026-12-07', shift_type: 'MORNING', expectedVersion: null }
  expect(batchRequestSchema.safeParse({ assignments: [cell, cell] }).success).toBe(false)
})
