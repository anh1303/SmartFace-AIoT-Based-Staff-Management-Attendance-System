import { beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../../src/config/env.js'
import { EngineError, engineCreate, engineFrame } from '../../src/modules/auth/face-login/face-login.engine.js'

const unitVec = Array(512).fill(1 / Math.sqrt(512))

function makeChunkedResponse(
  chunks: Uint8Array[],
  options: {
    status?: number
    headers?: Record<string, string>
    stallAfterChunk?: number
    onCancel?: () => void
  } = {},
) {
  let index = 0
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (options.stallAfterChunk !== undefined && index >= options.stallAfterChunk) {
        await new Promise(() => {})
        return
      }
      if (index < chunks.length) {
        controller.enqueue(chunks[index++])
      } else {
        controller.close()
      }
    },
    cancel() {
      options.onCancel?.()
    },
  })
  return new Response(stream, {
    status: options.status ?? 200,
    headers: options.headers,
  })
}

describe('Face login engine RPC stream reader and response contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(env, {
      FACE_AUTH_URL: 'http://127.0.0.1:5000',
      FACE_AUTH_INTERNAL_KEY: 'x'.repeat(32),
      FACE_AUTH_MODEL_VERSION: 'buffalo_s',
    })
  })

  it('accepts multi-chunk body up to 40,000 bytes and cancels reader immediately at 40,001 bytes without trusting Content-Length', async () => {
    const encoder = new TextEncoder()
    const baseObj = {
      attempt_id: 'a'.repeat(32),
      boot_id: 'boot-1',
      model_version: 'buffalo_s',
    }
    const baseJson = JSON.stringify(baseObj)
    const padLen40000 = 40_000 - encoder.encode(baseJson).byteLength
    const exact40000 = baseJson + ' '.repeat(padLen40000)
    expect(encoder.encode(exact40000).byteLength).toBe(40_000)

    const bytes40000 = encoder.encode(exact40000)
    const c1 = bytes40000.slice(0, 15_000)
    const c2 = bytes40000.slice(15_000, 30_000)
    const c3 = bytes40000.slice(30_000)

    // Dishonest small Content-Length header on a valid 40,000-byte multi-chunk stream still succeeds
    vi.stubGlobal('fetch', vi.fn(async () =>
      makeChunkedResponse([c1, c2, c3], { headers: { 'Content-Length': '100' } }),
    ))
    await expect(engineCreate('a'.repeat(32), 1, 15_000)).resolves.toBe('boot-1')

    // 40,001 bytes distributed across chunks cancels the stream reader and throws invalid
    let cancelled = false
    const extraChunk = new Uint8Array([32]) // 1 extra space -> 40,001 bytes
    const trailingSpyChunk = new Uint8Array([32, 32])
    vi.stubGlobal('fetch', vi.fn(async () =>
      makeChunkedResponse([c1, c2, c3, extraChunk, trailingSpyChunk], {
        headers: { 'Content-Length': '50' }, // Dishonest small Content-Length
        onCancel: () => { cancelled = true },
      }),
    ))
    await expect(engineCreate('a'.repeat(32), 1, 15_000)).rejects.toMatchObject({ kind: 'invalid' })
    expect(cancelled).toBe(true)

    // Oversized Content-Length header (> 40,000) rejects early and cancels body
    let earlyCancelled = false
    vi.stubGlobal('fetch', vi.fn(async () =>
      makeChunkedResponse([encoder.encode(baseJson)], {
        headers: { 'Content-Length': '40001' },
        onCancel: () => { earlyCancelled = true },
      }),
    ))
    await expect(engineCreate('a'.repeat(32), 1, 15_000)).rejects.toMatchObject({ kind: 'invalid' })
    expect(earlyCancelled).toBe(true)
  })

  it('enforces timeout across both fetch headers and stalled chunked body reading, and rejects malformed JSON', async () => {
    const encoder = new TextEncoder()
    let stalledCancelled = false
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const signal = init?.signal
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(encoder.encode('{"attempt_id":'))
          return new Promise<void>((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              stalledCancelled = true
              reject(signal.reason ?? new DOMException('Timed out', 'TimeoutError'))
            })
          })
        },
        cancel() {
          stalledCancelled = true
        },
      })
      return new Response(stream, { status: 200 })
    }))

    await expect(engineFrame('a'.repeat(32), 1, 1, 'YWJj', 'boot-1', 40, 'op-1')).rejects.toMatchObject({
      kind: 'timeout',
    })
    expect(stalledCancelled).toBe(true)

    // Invalid JSON -> invalid
    vi.stubGlobal('fetch', vi.fn(async () =>
      makeChunkedResponse([encoder.encode('{not-valid-json')]),
    ))
    await expect(engineCreate('a'.repeat(32), 1, 15_000)).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('requires operation_id in response to match non-empty request operationId and validates boot/model/seq/embedding', async () => {
    const aid = 'a'.repeat(32)
    const validPayload = {
      attempt_id: aid,
      boot_id: 'boot-1',
      seq: 1,
      operation_id: 'op-123',
      model_version: 'buffalo_s',
      status: 'embedding' as const,
      reason: 'ok',
      embedding: unitVec,
    }

    const respondWith = (override: Record<string, unknown>) => {
      const payload = { ...validPayload, ...override }
      for (const [k, v] of Object.entries(override)) {
        if (v === undefined) delete (payload as Record<string, unknown>)[k]
      }
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(payload))))
    }

    // Missing operation_id when request sent operationId 'op-123' MUST be rejected
    respondWith({ operation_id: undefined })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })

    // Empty or mismatched operation_id -> invalid
    respondWith({ operation_id: '' })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })
    respondWith({ operation_id: 'op-other' })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })

    // Wrong seq / model_version / attempt_id -> invalid; wrong boot_id -> gone
    respondWith({ seq: 2 })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })
    respondWith({ model_version: 'other' })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })
    respondWith({ boot_id: 'boot-2' })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'gone' })

    // Vector length != 512, zero vector, unnormalized vector, NaN/Infinity -> invalid
    respondWith({ embedding: unitVec.slice(0, 511) })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })
    respondWith({ embedding: Array(512).fill(0) })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })
    respondWith({ embedding: Array(512).fill(1) })
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })
    const nanVec = [...unitVec]; nanVec[0] = Number.NaN
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify(validPayload).replace(String(unitVec[0]), 'null'),
    )))
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).rejects.toMatchObject({ kind: 'invalid' })

    // Valid matching response succeeds
    respondWith({})
    await expect(engineFrame(aid, 1, 1, 'YWJj', 'boot-1', 1000, 'op-123')).resolves.toMatchObject({
      attempt_id: aid,
      operation_id: 'op-123',
      status: 'embedding',
    })
  })
})
