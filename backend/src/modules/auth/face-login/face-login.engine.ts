import { z } from 'zod'
import { env } from '../../../config/env.js'

/** Private RPC client for face_auth streaming endpoints. Never sends identity or thresholds. */
export class EngineError extends Error {
  constructor(readonly kind: 'busy' | 'gone' | 'conflict' | 'unavailable' | 'invalid' | 'timeout') { super(kind) }
}

const createSchema = z.object({ attempt_id: z.string(), boot_id: z.string().min(1), model_version: z.string() })
const frameSchema = z.object({
  attempt_id: z.string(), boot_id: z.string(), seq: z.number().int(), operation_id: z.string().optional(),
  model_version: z.string(), status: z.enum(['pending', 'embedding', 'reset', 'spoof', 'error']),
  reason: z.string().max(40), embedding: z.array(z.number().finite()).length(512).optional(),
})
export type EngineFrame = z.infer<typeof frameSchema>

async function call(path: string, body: unknown, timeoutMs: number, maxBytes = 40_000) {
  let response: Response
  try {
    response = await fetch(`${env.FACE_AUTH_URL}/internal/face-login${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Face-Auth-Key': env.FACE_AUTH_INTERNAL_KEY },
      body: JSON.stringify(body), signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
    })
  } catch (error) {
    throw new EngineError((error as Error)?.name === 'TimeoutError' ? 'timeout' : 'unavailable')
  }
  if (response.status === 429) throw new EngineError('busy')
  if (response.status === 410 || response.status === 404) throw new EngineError('gone')
  if (response.status === 409) throw new EngineError('conflict')
  if (!response.ok) throw new EngineError('unavailable')
  const text = await response.text()
  if (text.length > maxBytes) throw new EngineError('invalid')
  try { return JSON.parse(text) as unknown } catch { throw new EngineError('invalid') }
}

export async function engineCreate(attemptId: string, epoch: number, ttlMs: number) {
  const parsed = createSchema.safeParse(await call('/attempts', { attempt_id: attemptId, epoch, ttl_ms: ttlMs }, 3000))
  if (!parsed.success || parsed.data.attempt_id !== attemptId || parsed.data.model_version !== env.FACE_AUTH_MODEL_VERSION) {
    throw new EngineError('invalid')
  }
  return parsed.data.boot_id
}

export async function engineFrame(
  attemptId: string,
  epoch: number,
  seq: number,
  frame: string,
  bootId: string,
  timeoutMs: number,
  operationId = '',
) {
  const parsed = frameSchema.safeParse(
    await call(`/attempts/${attemptId}/frames`, { epoch, seq, operation_id: operationId, frame }, timeoutMs),
  )
  if (!parsed.success) throw new EngineError('invalid')
  const data = parsed.data
  if (data.attempt_id !== attemptId || data.seq !== seq || data.model_version !== env.FACE_AUTH_MODEL_VERSION) {
    throw new EngineError('invalid')
  }
  if (operationId && data.operation_id !== undefined && data.operation_id !== operationId) {
    throw new EngineError('invalid')
  }
  if (data.boot_id !== bootId) throw new EngineError('gone') // Python restarted: PAD evidence lost
  if (data.status === 'embedding') {
    if (!data.embedding) throw new EngineError('invalid')
    const norm = Math.hypot(...data.embedding)
    if (!Number.isFinite(norm) || norm <= 1e-12 || Math.abs(norm - 1) > 1e-3) throw new EngineError('invalid')
  }
  return data
}

export function engineCancel(attemptId: string) {
  call(`/attempts/${attemptId}/cancel`, {}, 2000).catch(() => undefined) // TTL sweep is the backstop
}
