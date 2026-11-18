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

function isTimeoutError(error: unknown, signal?: AbortSignal): boolean {
  const name = (error as { name?: string } | null)?.name
  if (name === 'TimeoutError') return true
  if (name === 'AbortError' && (signal?.reason as { name?: string } | null)?.name === 'TimeoutError') return true
  return false
}

async function readBoundedBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<string> {
  const contentLength = response.headers?.get('content-length')
  if (contentLength !== null && contentLength !== undefined && contentLength.trim() !== '') {
    const declared = Number(contentLength)
    if (Number.isFinite(declared) && declared > maxBytes) {
      try { await response.body?.cancel() } catch { /* ignore */ }
      throw new EngineError('invalid')
    }
  }

  if (!response.body) {
    let text: string
    try {
      text = await response.text()
    } catch (error) {
      throw new EngineError(isTimeoutError(error, signal) ? 'timeout' : 'unavailable')
    }
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new EngineError('invalid')
    return text
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      let piece: Awaited<ReturnType<typeof reader.read>>
      try {
        piece = await reader.read()
      } catch (error) {
        try { await reader.cancel() } catch { /* ignore */ }
        throw new EngineError(isTimeoutError(error, signal) ? 'timeout' : 'unavailable')
      }
      if (piece.done) break
      const value = piece.value
      if (!value) continue
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        try { await reader.cancel() } catch { /* ignore */ }
        throw new EngineError('invalid')
      }
      chunks.push(value)
    }
  } finally {
    try { reader.releaseLock() } catch { /* ignore */ }
  }

  const merged = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged)
}

async function call(path: string, body: unknown, timeoutMs: number, maxBytes = 40_000) {
  const signal = AbortSignal.timeout(Math.max(1, timeoutMs))
  let response: Response
  try {
    response = await fetch(`${env.FACE_AUTH_URL}/internal/face-login${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Face-Auth-Key': env.FACE_AUTH_INTERNAL_KEY },
      body: JSON.stringify(body), signal,
    })
  } catch (error) {
    throw new EngineError(isTimeoutError(error, signal) ? 'timeout' : 'unavailable')
  }
  if (!response.ok) {
    try { await response.body?.cancel() } catch { /* ignore */ }
    if (response.status === 429) throw new EngineError('busy')
    if (response.status === 410 || response.status === 404) throw new EngineError('gone')
    if (response.status === 409) throw new EngineError('conflict')
    throw new EngineError('unavailable')
  }
  const text = await readBoundedBody(response, maxBytes, signal)
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
  if (operationId && data.operation_id !== operationId) {
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
