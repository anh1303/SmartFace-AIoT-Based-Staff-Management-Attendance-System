import { env } from '../../../config/env.js'
import { AppError } from '../../../common/AppError.js'
import { authBiometrics } from '../auth.biometrics-port.js'
import { createFaceSession } from '../auth.service.js'
import { ATTEMPT_TTL_MS, AttemptError, AttemptStore, digestFrame, type Attempt } from './face-login.attempts.js'
import { EngineError, engineCancel, engineCreate, engineFrame } from './face-login.engine.js'

export const FACE_LOGIN_FAILURE = 'Không thể xác thực khuôn mặt. Vui lòng thử lại hoặc đăng nhập bằng mật khẩu.'
export const attempts = new AttemptStore()
const RPC_CAP_MS = 3000

const GUIDANCE: Record<string, string> = {
  no_face: 'Không thấy khuôn mặt. Hãy nhìn thẳng vào camera.',
  face_quality: 'Đưa khuôn mặt vào giữa khung, giữ đủ sáng.',
  track_changed: 'Giữ yên khuôn mặt trong khung.',
  frame_gap: 'Giữ yên khuôn mặt trong khung.',
  raw_spoof: 'Giữ yên khuôn mặt trong khung.',
  spoof: 'Giữ yên khuôn mặt trong khung.',
  invalid_image: 'Ảnh camera không hợp lệ, đang thử lại.',
  pad_pending: 'Đang kiểm tra người thật…',
  ok: 'Đang xác nhận danh tính…',
  no_match: 'Đang xác nhận danh tính…',
}

function parseRecognitionCount(): number {
  const raw = process.env.ATTENDANCE_STABLE_COUNT
  if (raw === undefined) return 3
  const trimmed = raw.trim()
  if (trimmed === '') return 3
  if (!/^\d+$/.test(trimmed)) return Number.NaN
  return Number(trimmed)
}

export function recognitionCount() {
  const parsed = parseRecognitionCount()
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : 3
}

export function faceLoginConfigured() {
  const parsed = parseRecognitionCount()
  return env.FACE_LOGIN_ENABLED && env.FACE_AUTH_INTERNAL_KEY.length >= 32
    && Number.isInteger(parsed) && parsed >= 1 && parsed <= 6
}

const toAppError = (error: unknown): never => {
  if (error instanceof AttemptError) {
    if (error.status === 410) {
      throw new AppError(410, 'Lượt nhận diện đã kết thúc. Vui lòng thử lại.')
    }
    if (error.status === 429) {
      const code = error.code === 'frame_rate' ? 'FRAME_RATE_LIMIT' : 'ATTEMPT_CAPACITY'
      throw new AppError(429, 'Hệ thống đang bận. Vui lòng thử lại sau.', undefined, code)
    }
    throw new AppError(error.status, 'Yêu cầu nhận diện không hợp lệ.')
  }
  throw error
}

export function invalidateFaceLoginBinding(binding: string | undefined): void {
  if (!binding) return
  const cancelledIds = attempts.invalidateBinding(binding)
  for (const id of cancelledIds) {
    engineCancel(id)
  }
}

export function dropCompletedFaceLoginRecovery(binding: string | undefined): void {
  if (!binding) return
  attempts.dropCompletedRecovery(binding)
}

export async function startAttempt(binding: string) {
  let attempt: Attempt
  try { attempt = attempts.create(binding, recognitionCount()) } catch (error) { return toAppError(error) }
  attempts.dropCompletedRecovery(binding)
  try {
    attempt.bootId = await engineCreate(attempt.id, attempt.epoch, ATTEMPT_TTL_MS)
  } catch (error) {
    attempts.fail(attempt)
    if (error instanceof EngineError && error.kind === 'busy') {
      throw new AppError(429, 'Dịch vụ nhận diện chưa sẵn sàng. Vui lòng thử lại hoặc đăng nhập bằng mật khẩu.', undefined, 'ATTEMPT_CAPACITY')
    }
    throw new AppError(503,
      'Dịch vụ nhận diện chưa sẵn sàng. Vui lòng thử lại hoặc đăng nhập bằng mật khẩu.')
  }
  if (attempt.state !== 'READY') { engineCancel(attempt.id); throw new AppError(409, 'Lượt nhận diện đã bị thay thế.') }
  return {
    attemptId: attempt.id,
    expiresAt: attempt.deadline,
    remainingMs: Math.max(0, attempt.deadline - Date.now()),
    intervalMs: 200,
  }
}

async function matchEmployee(embedding: number[]) {
  const norm = Math.hypot(...embedding)
  if (!Number.isFinite(norm) || norm <= 1e-12) throw new Error('Invalid embedding norm')
  const literal = '[' + embedding.map(value => (value / norm).toFixed(8)).join(',') + ']'
  const candidate = await authBiometrics().findBestFaceMatch(literal, undefined, { includeAvatar: false })
  if (!candidate || !Number.isFinite(candidate.similarity) || candidate.similarity < (env.FACE_MATCH_THRESHOLD || 0.45)) return null
  return candidate.emp_id
}

export async function processAttemptFrame(id: string, binding: string | undefined, seq: number, frame: string) {
  let attempt: Attempt, op: string
  const digest = digestFrame(frame)
  try {
    attempt = attempts.get(id, binding)
    const reserved = attempts.startFrame(attempt, seq, digest)
    if ('cached' in reserved) return reserved.cached
    op = reserved.op
  } catch (error) { return toAppError(error) }

  let engine
  try {
    const remaining = attempt.deadline - Date.now()
    engine = await engineFrame(attempt.id, attempt.epoch, seq, frame, attempt.bootId!, Math.min(RPC_CAP_MS, remaining), op)
  } catch (error) {
    if (error instanceof EngineError && error.kind === 'busy') {
      attempts.releaseFrame(attempt, op)
      throw new AppError(429, 'Hệ thống đang bận, đang thử lại.', undefined, 'ENGINE_BUSY')
    }
    // Timeout/restart/invalid: inference may still be running, never reopen.
    attempts.fail(attempt); engineCancel(attempt.id)
    throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  }
  if (!attempts.isCurrent(attempt, op)) throw new AppError(410, 'Lượt nhận diện đã kết thúc. Vui lòng thử lại.')
  if (engine.status === 'spoof' || engine.status === 'error') {
    attempts.fail(attempt); engineCancel(attempt.id)
    throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  }

  let employeeId: string | null = null
  let reason = engine.reason
  if (engine.status === 'embedding') {
    try { employeeId = await matchEmployee(engine.embedding!) } catch {
      attempts.fail(attempt); engineCancel(attempt.id)
      throw new AppError(503, 'Dịch vụ nhận diện đang gián đoạn. Vui lòng đăng nhập bằng mật khẩu.')
    }
    if (!employeeId) reason = 'no_match'
  }
  try {
    const result = attempts.finishFrame(attempt, op, seq, digest,
      { employeeId, pending: engine.status === 'pending' }, GUIDANCE[reason] ?? 'Giữ yên khuôn mặt trong khung.')
    if (result.state === 'verified') engineCancel(attempt.id) // stop PAD work immediately
    return result
  } catch (error) { return toAppError(error) }
}

export async function completeAttempt(id: string, binding: string | undefined) {
  if (!faceLoginConfigured()) {
    throw new AppError(503, 'Đăng nhập khuôn mặt chưa được bật. Vui lòng dùng mật khẩu.')
  }
  let attempt: Attempt
  try {
    attempt = attempts.get(id, binding)
    const recovered = attempts.recover(attempt)
    if (recovered) return recovered
    const employeeId = attempts.assertCompletable(attempt)
    // Awaited account/template/role checks; cancel/expiry may win meanwhile.
    let session
    try {
      session = await createFaceSession(employeeId)
    } catch (error) {
      attempts.fail(attempt)
      throw error
    }
    return attempts.commit(attempt, session) // re-checks all guards synchronously
  } catch (error) { return toAppError(error) }
}

export function cancelAttempt(id: string, binding: string | undefined) {
  try {
    const attempt = attempts.get(id, binding)
    attempts.cancel(attempt)
    engineCancel(attempt.id)
  } catch (error) { toAppError(error) }
}

export function attemptStatus(id: string, binding: string | undefined) {
  try {
    const a = attempts.get(id, binding)
    return {
      state: a.state.toLowerCase(),
      nextSeq: a.nextSeq,
      expiresAt: a.deadline,
      remainingMs: Math.max(0, a.deadline - Date.now()),
    }
  } catch (error) { return toAppError(error) }
}

setInterval(() => attempts.sweep(), 1000).unref()
