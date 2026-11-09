import { z } from 'zod'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { workDateSchema } from '../../common/date.schema.js'
import { getTodayVNString } from '../../common/utils.js'
import { assertCanManageEmployee, findEmployeeByIdOrCode } from '../employees/public.js'
import { enqueueOperation, findOperationByKey, safeError, type OperationItem } from '../operations/public.js'
import { type OperationRow, summarizeItems, publicOperation } from '../operations/public.js'
import { currentActor } from '../operations/public.js'
import { announceOperation, announceDataChange } from '../operations/public.js'
import { assignOrUpdate, formatShift } from './shift.service.js'

const assignmentSchema = z.object({
  employee_id: z.string().min(1).max(50), date: workDateSchema,
  shift_type: z.enum(['MORNING', 'AFTERNOON', 'OFFICE_HOURS', 'OTHER', 'OFF']),
  start_time: z.string().max(5).optional(), end_time: z.string().max(5).optional(), note: z.string().max(255).optional(),
  expectedVersion: z.number().int().positive().nullable(),
})
export const batchRequestSchema = z.object({ assignments: z.array(assignmentSchema).min(1).max(2000) })
  .refine(data => new Set(data.assignments.map(i => `${i.employee_id}:${i.date}`)).size === data.assignments.length, 'Có ca trùng trong cùng lệnh.')
export const copyWeekSchema = z.object({
  sourceMonday: workDateSchema, targetMonday: workDateSchema,
  employeeIds: z.array(z.string().min(1).max(50)).min(1).max(250),
  expectedTargetVersions: z.record(z.number().int().positive().nullable()),
}).refine(d => new Date(`${d.sourceMonday}T00:00:00Z`).getUTCDay() === 1 && new Date(`${d.targetMonday}T00:00:00Z`).getUTCDay() === 1 &&
  +new Date(d.targetMonday) - +new Date(d.sourceMonday) === 7 * 86400000, 'Chỉ sao chép từ tuần liền trước, bắt đầu vào thứ Hai.')

type Actor = { id: string; role: string }
export async function submitBatch(input: z.infer<typeof batchRequestSchema>, actor: Actor, key: string) {
  const previous = await findOperationByKey(actor.id, key, 'shifts.batch', input)
  if (previous) return publicOperation(previous)
  const employees = new Map<string, string>()
  for (const code of new Set(input.assignments.map(a => a.employee_id))) {
    await assertCanManageEmployee(actor, code)
    const emp = await findEmployeeByIdOrCode(code)
    if (!emp) throw AppError.notFound('Không tìm thấy nhân viên.')
    employees.set(code, emp.id)
  }
  return prisma.$transaction(tx => enqueueOperation(tx, { ownerId: actor.id, key, type: 'shifts.batch', label: `Phân lịch ${input.assignments.length} ca`, payload: {}, fingerprint: input,
    items: input.assignments.map(a => ({ key: `${a.employee_id}:${a.date}`, payload: { ...a, employee_id: employees.get(a.employee_id) }, skipped: a.date < getTodayVNString() })) }), { timeout: 60000 })
}
export async function submitCopy(input: z.infer<typeof copyWeekSchema>, actor: Actor, key: string) {
  const previous = await findOperationByKey(actor.id, key, 'shifts.batch', input)
  if (previous) return publicOperation(previous)
  const assignments: z.infer<typeof assignmentSchema>[] = []
  const end = new Date(+new Date(input.sourceMonday) + 7 * 86400000)
  for (const code of [...new Set(input.employeeIds)].sort()) {
    await assertCanManageEmployee(actor, code)
    const emp = await findEmployeeByIdOrCode(code)
    if (!emp) throw AppError.notFound('Không tìm thấy nhân viên.')
    const shifts = await prisma.employee_shifts.findMany({ where: { employee_id: emp.id, work_date: { gte: new Date(input.sourceMonday), lt: end } }, include: { work_shifts: true } })
    for (const shift of shifts) {
      const date = new Date(+shift.work_date + 7 * 86400000).toISOString().slice(0, 10)
      const cell = `${code}:${date}`
      if (!Object.prototype.hasOwnProperty.call(input.expectedTargetVersions, cell)) throw AppError.conflict('Thiếu phiên bản lịch đích. Vui lòng tải lại lịch.')
      const formatted = formatShift(shift)
      assignments.push({ employee_id: code, date, shift_type: formatted.shift_type as any, start_time: formatted.start_time, end_time: formatted.end_time, note: formatted.note || 'Sao chép tuần trước', expectedVersion: input.expectedTargetVersions[cell] })
    }
  }
  // Fingerprint the submitted command, not the current source: repeat submission must resolve to the original snapshot.
  const items = assignments.map(a => ({ key: `${a.employee_id}:${a.date}`, payload: a, skipped: a.date < getTodayVNString() }))
  return prisma.$transaction(tx => enqueueOperation(tx, { ownerId: actor.id, key, type: 'shifts.batch', label: 'Sao chép lịch tuần trước', payload: { sourceMonday: input.sourceMonday, targetMonday: input.targetMonday }, fingerprint: input, items }), { timeout: 60000 })
}
export async function executeShiftBatch(job: OperationRow) {
  const items = await prisma.$queryRaw<OperationItem[]>`SELECT * FROM background_operation_items WHERE operation_id = ${job.id}::uuid ORDER BY item_key`
  for (const item of items) {
    if (item.status !== 'queued') continue
    try {
      const actor = await currentActor(job.owner_id)
      await prisma.$transaction(async tx => {
        const owned = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM background_operations WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid AND status = 'running' FOR UPDATE`
        if (!owned.length) throw AppError.conflict('Tác vụ đã được chuyển cho tiến trình khác.')
        const current = await tx.$queryRaw<OperationItem[]>`SELECT * FROM background_operation_items WHERE id = ${item.id}::uuid FOR UPDATE`
        if (current[0].status !== 'queued') return
        await assignOrUpdate(item.payload, actor.id, actor.role, { tx, expectedVersion: item.payload.expectedVersion })
        await tx.$executeRaw`UPDATE background_operation_items SET status = 'succeeded', error = NULL WHERE id = ${item.id}::uuid`
      }, { timeout: 60000, maxWait: 20000 })
    } catch (error) {
      await prisma.$executeRaw`UPDATE background_operation_items SET status = 'failed', error = ${safeError(error)} WHERE id = ${item.id}::uuid AND status = 'queued'
        AND EXISTS (SELECT 1 FROM background_operations WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid)`
    }
    await refreshBatchProgress(job, false)
  }
  await refreshBatchProgress(job, true)
  await announceDataChange('shifts', items.map(item => item.payload.employee_id), job.owner_id)
}
async function refreshBatchProgress(job: OperationRow, final: boolean) {
  const items = await prisma.$queryRaw<{ status: string }[]>`SELECT status FROM background_operation_items WHERE operation_id = ${job.id}::uuid`
  const p = summarizeItems(items)
  await prisma.$executeRaw`UPDATE background_operations SET status = ${final ? p.status : 'running'}, total = ${p.total}, completed = ${p.completed}, succeeded = ${p.succeeded}, failed = ${p.failed}, skipped = ${p.skipped}, updated_at = now(), revision = revision + 1 WHERE id = ${job.id}::uuid AND lease_token = ${job.lease_token}::uuid`
  await announceOperation(job.owner_id, job.id)
}
