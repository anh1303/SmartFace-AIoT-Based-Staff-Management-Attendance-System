import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { AppError } from '../../common/AppError.js'
import { liveSessionStates } from './fingerprint.service.js'

export const scanSchema = z.object({ device_id: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  event_id: z.string().regex(/^[a-zA-Z0-9_-]{8,120}$/), client_timestamp: z.coerce.number().finite().positive(),
  mode: z.enum(['AUTO','CHECK_IN','CHECK_OUT']), binding_id: z.string().uuid(), slot: z.number().int().nonnegative(),
  revision: z.number().int().positive(), match_score: z.number().int().min(0).max(65535), event_kind: z.literal('FINGERPRINT_SCAN') })
export type FingerprintScan = z.infer<typeof scanSchema>
export async function requireFingerprintBinding(tx: Prisma.TransactionClient, scan: FingerprintScan, employeeId?: string) {
  const b = await tx.fingerprintBinding.findUnique({ where: { id: scan.binding_id }, include: { template: { include: { employee: true } } } })
  const device = await tx.fingerprintDevice.findUnique({ where: { device_id: scan.device_id } })
  if (!device?.attendance_enabled || !device.ready || (!device.wak_verified && !device.polling_fallback)
      || !device.roundtrip_verified || Date.now() - +device.last_seen > 90_000) throw AppError.forbidden('Vân tay đang ở chế độ thử nghiệm hoặc cảm biến chưa sẵn sàng')
  if (!b || b.device_id !== scan.device_id || b.slot !== scan.slot || b.state !== 'SYNCED'
      || b.template.status !== 'ACTIVE' || b.template.revision !== scan.revision
      || (employeeId && b.template.employee_id !== employeeId) || b.template.employee.status !== 'ACTIVE') throw AppError.forbidden('Binding vân tay không hợp lệ hoặc đã bị thu hồi')
  return b
}
export async function assertNoFingerprintMaintenance(tx: Prisma.TransactionClient, deviceId: string) {
  const session = await tx.fingerprintSession.findFirst({ where: { device_id: deviceId, status: { in: liveSessionStates },
    OR: [{ status: 'SYNCING' }, { expires_at: { gt: new Date() } }] } })
  if (session) throw AppError.conflict('Thiết bị đang đăng ký/đồng bộ vân tay; chờ hoàn tất')
}
