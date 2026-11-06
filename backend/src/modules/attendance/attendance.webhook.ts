import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { eventBus } from '../../common/event-bus.js'
import { observeRecognition, requiredRecognitionCount } from './recognition-confirmation.js'
import { findBestFaceMatch } from '../biometrics/public.js'
import { claimAlert } from './attendance.alert-dedup.js'
import { MAX_PAIR_MS } from './attendance.policy.js'
import { attendanceIntervalRemaining, attendanceIntervalMessage } from './attendance.interval.js'

export interface ThingsBoardWebhookPayload {
  device_id?: string
  mode?: string
  antispoof_score?: number
  embedding?: number[]
  embedding_b64?: string
  event_id?: string
  event_kind?: string
  recognition_id?: string
  expected_employee_id?: string
  client_timestamp?: number | string
}

export async function processThingsBoardWebhook(data: ThingsBoardWebhookPayload, actions: { checkIn: typeof import('./attendance.service.js').checkIn; checkOut: typeof import('./attendance.service.js').checkOut }) {
  const { device_id, mode, antispoof_score } = data
  const normalizedRequestedMode = (mode && mode !== 'OFF' && mode !== 'IDLE' ? mode : 'AUTO').toUpperCase()
  if (!device_id || !['CHECK_IN', 'CHECK_OUT', 'AUTO'].includes(normalizedRequestedMode)) throw AppError.badRequest('device_id/mode không hợp lệ')
  if (typeof antispoof_score !== 'number' || !Number.isFinite(antispoof_score) || antispoof_score < 0 || antispoof_score > 1) throw AppError.badRequest('Cần điểm liveness hợp lệ')
  if (!data.event_id || !/^[a-zA-Z0-9_-]{8,120}$/.test(data.event_id)) throw AppError.badRequest('Cần event_id duy nhất cho lượt ghi nhận')
  const capturedAt = Number(data.client_timestamp)
  if (!Number.isFinite(capturedAt) || capturedAt <= 0) throw AppError.badRequest('client_timestamp không hợp lệ')

  // Anti-spoofing check
  if (typeof antispoof_score === 'number' && antispoof_score < 0.5) {
    if (typeof data.recognition_id === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(data.recognition_id)) {
      observeRecognition(device_id, `${normalizedRequestedMode}:${data.event_id}`, data.recognition_id, null)
    }
    if (await claimAlert('spoof', device_id, data.event_id)) {
      eventBus.publish('attendance:spoof-blocked', {
        device_id,
        event_id: data.event_id,
        similarity: antispoof_score,
        timestamp: new Date().toISOString(),
        status: 'BLOCKED_SPOOF',
      })
    }
    return {
      success: false,
      matched: false,
      event_id: data.event_id,
      message: 'Khuôn mặt bị nghi ngờ giả mạo (Anti-spoofing rejected)',
      antispoof_score,
    }
  }

  const isConfirmation = ['VERIFY_ONLY', 'CONFIRMED_SCAN'].includes(data.event_kind || '')
  if (!isConfirmation) throw AppError.badRequest('Face attendance requires consecutive recognition confirmations; update edge client')
  if (data.event_kind && !isConfirmation) throw AppError.badRequest('Loại sự kiện không hợp lệ')
  if (isConfirmation && (typeof data.recognition_id !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(data.recognition_id))) {
    throw AppError.badRequest('Cần recognition_id duy nhất cho từng lượt nhận diện')
  }
  // A single-confirmation client has no prior identity; matching below remains authoritative.
  if (data.event_kind === 'CONFIRMED_SCAN' &&
      (requiredRecognitionCount() > 1 || data.expected_employee_id !== undefined) &&
      (typeof data.expected_employee_id !== 'string' || !data.expected_employee_id.trim())) {
    throw AppError.badRequest('Cần expected_employee_id khi xác nhận điểm danh')
  }

  // Giải mã vector: Hỗ trợ cả Base64 Float32 (tối ưu ~2.7KB) và Array JSON truyền thống
  let vector: ArrayLike<number> | null = null

  if (typeof data.embedding_b64 === 'string' && data.embedding_b64.trim()) {
    try {
      const buf = Buffer.from(data.embedding_b64.trim(), 'base64')
      if (buf.length !== 512 * 4) {
        throw new Error(`Buffer size is ${buf.length} bytes, expected 2048 bytes (512 float32)`)
      }
      vector = new Float32Array(buf.buffer, buf.byteOffset, buf.length / Float32Array.BYTES_PER_ELEMENT)
    } catch (err: any) {
      throw AppError.badRequest(`Invalid embedding_b64: ${err.message}`)
    }
  } else if (Array.isArray(data.embedding)) {
    vector = data.embedding
  }

  if (!vector || vector.length !== 512) {
    throw AppError.badRequest('Invalid embedding vector: must be an array or base64 of 512 float32 numbers')
  }

  // L2 Normalize vector
  let norm = 0
  for (let i = 0; i < vector.length; i++) {
    const val = vector[i]
    if (typeof val !== 'number' || !isFinite(val)) {
      throw AppError.badRequest('Embedding contains non-finite numbers')
    }
    norm += val * val
  }
  norm = Math.sqrt(norm)
  if (norm === 0) {
    throw AppError.badRequest('Embedding norm is zero')
  }
  const parts: string[] = []
  for (let i = 0; i < vector.length; i++) {
    parts.push((vector[i] / norm).toFixed(8))
  }
  const vecLiteral = '[' + parts.join(',') + ']'

  // Vector similarity search against active employees in DB
  const MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD) || 0.45
  const bestMatch = await findBestFaceMatch(vecLiteral)

  if (!bestMatch || bestMatch.similarity < MATCH_THRESHOLD) {
    if (isConfirmation) observeRecognition(device_id, `${normalizedRequestedMode}:${data.event_id}`, data.recognition_id!, null)
    const bestSim = bestMatch ? Number(bestMatch.similarity.toFixed(4)) : 0
    if (await claimAlert('unknown', device_id, data.event_id)) {
      eventBus.publish('attendance:unknown', {
        device_id,
        event_id: data.event_id,
        similarity: bestSim,
        timestamp: new Date().toISOString(),
        status: 'UNKNOWN_FACE',
      })
    }
    return {
      success: false,
      matched: false,
      similarity: bestSim,
      event_id: data.event_id,
      message: 'Không tìm thấy nhân viên phù hợp hoặc độ tương đồng quá thấp',
    }
  }

  const match = bestMatch

  // Logic 1: Tự động phân định CHECK_IN / CHECK_OUT nếu mode = AUTO (hoặc không truyền)
  let resolvedMode: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN'
  let cooldownResponse: any = null
  if (normalizedRequestedMode === 'AUTO') {
    // Use the same pairing window as the writer so overnight shifts keep their check-in.
    const lastLog = await prisma.attendance_logs.findFirst({
      where: {
        employee_id: match.emp_id,
        status: 'VALID',
        event_time: { gte: new Date(capturedAt - MAX_PAIR_MS), lte: new Date(capturedAt) },
      },
      orderBy: [{ event_time: 'desc' }, { id: 'desc' }],
    })

    // Cheap AUTO fast path; the writer also enforces the interval inside its employee lock.
    const remainingSec = attendanceIntervalRemaining(lastLog?.created_at ?? lastLog?.event_time)
    if (lastLog && remainingSec > 0) {
      cooldownResponse = {
        success: true,
        ignored: true,
        retry_after_seconds: remainingSec,
        matched: true,
        door_open: false,
        cooldown: true,
        event_id: data.event_id,
        mode: lastLog.type,
        employee: {
          id: match.emp_id,
          employee_code: match.employee_code,
          full_name: match.full_name,
          avatar_url: match.avatar_url,
        },
        similarity: Number(match.similarity.toFixed(4)),
        message: attendanceIntervalMessage(remainingSec),
      }
    }

    // Khi đã hết thời gian cooldown:
    // Chưa có lượt nào hôm nay hoặc lượt gần nhất là CHECK_OUT -> CHECK_IN
    // Lượt gần nhất là CHECK_IN và đã qua cooldown -> CHECK_OUT
    resolvedMode = (!lastLog || lastLog.type === 'CHECK_OUT') ? 'CHECK_IN' : 'CHECK_OUT'
  } else {
    resolvedMode = normalizedRequestedMode === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN'
  }

  const isCheckOut = resolvedMode === 'CHECK_OUT'

  if (isConfirmation) {
    const confirmation = observeRecognition(device_id, `${normalizedRequestedMode}:${data.event_id}`, data.recognition_id!, match.emp_id)
    if (data.event_kind === 'VERIFY_ONLY' || !confirmation.ready ||
        (data.expected_employee_id !== undefined && data.expected_employee_id !== match.emp_id)) {
      return {
        success: true, matched: true, verification_only: true, event_id: data.event_id,
        mode: resolvedMode, recognition_id: data.recognition_id,
        confirmation_count: confirmation.count, confirmation_required: confirmation.required,
        employee: {id: match.emp_id, employee_code: match.employee_code, full_name: match.full_name, avatar_url: match.avatar_url},
        similarity: Number(match.similarity.toFixed(4)),
        message: `Xác minh ${resolvedMode} ${Math.min(confirmation.count, confirmation.required)}/${confirmation.required}; chưa ghi điểm danh`,
      }
    }
  }

  if (cooldownResponse) return cooldownResponse

  try {
    let attendanceRecord
    if (isCheckOut) {
      attendanceRecord = await actions.checkOut(match.emp_id, `device:${device_id}`, undefined, { eventId: data.event_id, capturedAt, deviceId: device_id, verified: true, verificationScore: match.similarity, livenessScore: antispoof_score, syncSummary: false })
    } else {
      attendanceRecord = await actions.checkIn({
        employeeId: match.emp_id,
        device_info: `device:${device_id}`,
        method: 'FACE',
      }, undefined, { eventId: data.event_id, capturedAt, deviceId: device_id, verified: true, verificationScore: match.similarity, livenessScore: antispoof_score, syncSummary: false })
    }

    if (attendanceRecord.status === 'FLAGGED' || attendanceRecord.access_denied) {
      if (attendanceRecord.status === 'FLAGGED' && !attendanceRecord.duplicate) eventBus.publish('attendance:flagged', {
        device_id,
        event_id: data.event_id,
        employee_id: match.emp_id,
        reason: 'CLOSED_PERIOD_OR_FINALIZED',
        timestamp: new Date().toISOString(),
      })
      return {
        success: false,
        door_open: false,
        matched: true,
        event_id: data.event_id,
        mode: resolvedMode,
        employee: {
          id: match.emp_id,
          employee_code: match.employee_code,
          full_name: match.full_name,
          avatar_url: match.avatar_url,
        },
        similarity: Number(match.similarity.toFixed(4)),
        attendance: attendanceRecord,
        code: 403,
        message: 'Kỳ công đã chốt hoặc nhân viên đã quyết toán nghỉ việc; điểm danh bị gắn cờ và từ chối mở cửa',
      }
    }

    // Realtime Socket.IO Event was already dispatched by actions.checkIn / checkOut via eventBus


    return {
      success: true,
      door_open: !attendanceRecord.ignored,
      ...(attendanceRecord.ignored ? { ignored: true, cooldown: true, retry_after_seconds: attendanceRecord.retry_after_seconds } : {}),
      matched: true,
      event_id: data.event_id,
      mode: resolvedMode,
      employee: {
        id: match.emp_id,
        employee_code: match.employee_code,
        full_name: match.full_name,
        avatar_url: match.avatar_url,
      },
      similarity: Number(match.similarity.toFixed(4)),
      attendance: attendanceRecord,
      message: attendanceRecord.ignored ? attendanceRecord.message : `${isCheckOut ? 'Check-out' : 'Check-in'} thành công`,
    }
  } catch (err: any) {
    // Return structured response for 409 (already checked in / out today)
    return {
      success: false,
      door_open: false,
      matched: true,
      event_id: data.event_id,
      mode: resolvedMode,
      employee: {
        id: match.emp_id,
        employee_code: match.employee_code,
        full_name: match.full_name,
        avatar_url: match.avatar_url,
      },
      similarity: Number(match.similarity.toFixed(4)),
      code: err.statusCode || 400,
      message: err.message || 'Lỗi xử lý điểm danh',
    }
  }
}

