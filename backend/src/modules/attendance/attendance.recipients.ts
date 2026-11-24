import { isEmployeeManager, findEmployeeByIdOrCode, findEmployeeByUserId } from '../employees/public.js'
import type { AttendanceRecipientMeta } from '../../common/event-bus.js'

export function roomsFromRecipientMeta(meta: AttendanceRecipientMeta | null | undefined): string[] {
  const rooms = ['ADMIN']
  if (meta) {
    if (meta.departmentId && !meta.isManager) {
      rooms.push(`department:${meta.departmentId}`)
    }
    rooms.push(`employee:${meta.id}`)
    if (meta.user_id) {
      rooms.push(`user:${meta.user_id}`)
    }
  }
  return rooms
}

export async function resolveCurrentRecipientMeta(
  empId?: string | null,
  userId?: string | null,
): Promise<AttendanceRecipientMeta | null> {
  const employee = empId
    ? await findEmployeeByIdOrCode(String(empId), undefined, 'identity')
    : userId
      ? await findEmployeeByUserId(String(userId), undefined, 'identity')
      : null
  if (!employee) return null
  return {
    id: employee.id,
    departmentId: employee.departmentId ?? null,
    user_id: employee.user_id ?? null,
    isManager: isEmployeeManager(employee),
  }
}

export async function attendanceRecipientRooms(
  payload: unknown,
  recipientMeta?: AttendanceRecipientMeta | null,
): Promise<string[]> {
  if (recipientMeta !== undefined) {
    return roomsFromRecipientMeta(recipientMeta)
  }

  const p = payload as any
  const empId = p?.employee_uuid || p?.employee_id || p?.employeeId || p?.employees?.id || p?.employees?.employee_code
  const userId = p?.employee_user_id || p?.user_id || p?.userId || p?.employees?.user_id
  const resolved = await resolveCurrentRecipientMeta(empId, userId)
  return roomsFromRecipientMeta(resolved)
}
