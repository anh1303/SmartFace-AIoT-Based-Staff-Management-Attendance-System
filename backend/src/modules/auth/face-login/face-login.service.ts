import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { env } from '../../../config/env.js'
import { AppError } from '../../../common/AppError.js'
import { authBiometrics } from '../auth.biometrics-port.js'
import { createFaceSession } from '../auth.service.js'

export const FACE_LOGIN_FAILURE = 'Không thể xác thực khuôn mặt. Vui lòng thử lại hoặc đăng nhập bằng mật khẩu.'
export const loginBody = z.object({ challengeId: z.string().regex(/^[a-f0-9]{32}$/),
  frames: z.array(z.string().min(4).max(273068).regex(/^[A-Za-z0-9+/]+={0,2}$/)).length(8),
}).strict()

export function faceLoginConfigured() {
  return env.FACE_LOGIN_ENABLED && env.FACE_AUTH_INTERNAL_KEY.length >= 32 && recognitionCount() <= 6
}

function recognitionCount() {
  return Math.max(1, Number.parseInt(process.env.ATTENDANCE_STABLE_COUNT || '3', 10) || 3)
}

const aiResponse = z.object({ request_id: z.string(), status: z.literal('ok'),
  model_version: z.string(), embeddings: z.array(z.array(z.number().finite()).length(512)).min(1).max(6) })

export async function recognizeLogin(frames: string[]) {
  const requestId = randomBytes(16).toString('hex')
  let response: Response
  try {
    response = await fetch(`${env.FACE_AUTH_URL}/internal/face-login/extract`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Face-Auth-Key': env.FACE_AUTH_INTERNAL_KEY },
      body: JSON.stringify({ request_id: requestId, frames, recognition_count: recognitionCount() }),
      signal: AbortSignal.timeout(Math.min(env.FACE_AUTH_TIMEOUT_MS, 20000)),
    })
  } catch { throw new AppError(503, 'Dịch vụ nhận diện đang gián đoạn. Vui lòng đăng nhập bằng mật khẩu.') }
  if (!response.ok) throw new AppError(503, 'Dịch vụ nhận diện chưa sẵn sàng. Vui lòng thử lại sau.')
  let parsed: ReturnType<typeof aiResponse.safeParse>
  const reader = response.body?.getReader()
  if (!reader) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  try {
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 80_000) { await reader.cancel(); throw new Error('Response too large') }
      chunks.push(chunk.value)
    }
    parsed = aiResponse.safeParse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
  } catch { throw AppError.unauthorized(FACE_LOGIN_FAILURE) }
  finally { reader.releaseLock() }
  if (!parsed.success || parsed.data.request_id !== requestId || parsed.data.model_version !== env.FACE_AUTH_MODEL_VERSION) {
    throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  }
  if (parsed.data.embeddings.length !== recognitionCount()) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  let employeeId: string | undefined
  for (const embedding of parsed.data.embeddings) {
    const norm = Math.hypot(...embedding)
    if (!Number.isFinite(norm) || norm < 1e-12) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
    const literal = '[' + embedding.map(value => (value / norm).toFixed(8)).join(',') + ']'
    const candidate = await authBiometrics().findBestFaceMatch(literal, undefined, { includeAvatar: false })
    if (!candidate || !Number.isFinite(candidate.similarity) || candidate.similarity < (env.FACE_MATCH_THRESHOLD || 0.45)
        || (employeeId && candidate.emp_id !== employeeId)) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
    employeeId = candidate.emp_id
  }
  if (!employeeId) throw AppError.unauthorized(FACE_LOGIN_FAILURE)
  return createFaceSession(employeeId)
}
