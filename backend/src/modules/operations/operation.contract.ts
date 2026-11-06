import { createHash } from 'node:crypto'

export type OperationStatus = 'queued' | 'running' | 'succeeded' | 'partially_succeeded' | 'failed'
export interface OperationRow {
  id: string; owner_id: string; type: string; label: string; status: OperationStatus;
  revision: number; total: number; completed: number; succeeded: number; failed: number; skipped: number;
  payload: any; result: any; error: string | null; attempts: number; lease_token: string | null;
  created_at: Date; updated_at: Date;
}
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]))
  return value
}
export const payloadHash = (payload: unknown) => createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex')
export function summarizeItems(items: { status: string }[]) {
  const succeeded = items.filter(i => i.status === 'succeeded').length
  const failed = items.filter(i => i.status === 'failed').length
  const skipped = items.filter(i => i.status === 'skipped').length
  const completed = succeeded + failed + skipped
  const status: OperationStatus = completed < items.length ? 'running' : failed ? (succeeded ? 'partially_succeeded' : 'failed') : 'succeeded'
  return { status, total: items.length, completed, succeeded, failed, skipped }
}
export function publicOperation(row: OperationRow) {
  return { jobId: row.id, type: row.type, label: row.label, status: row.status, revision: row.revision,
    progress: { total: row.total, completed: row.completed, succeeded: row.succeeded, failed: row.failed, skipped: row.skipped },
    error: row.error, createdAt: row.created_at, updatedAt: row.updated_at }
}
