import { isEmployeeManager, findEmployeeByIdOrCode, findEmployeeByUserId } from '../employees/public.js'

export async function attendanceRecipientRooms(payload: unknown): Promise<string[]> {
  const p = payload as any
  const empId = p?.employee_uuid || p?.employee_id || p?.employeeId || p?.employees?.id || p?.employees?.employee_code
  const userId = p?.employee_user_id || p?.user_id || p?.userId || p?.employees?.user_id
  const employee = empId
    ? await findEmployeeByIdOrCode(String(empId), undefined, 'identity')
    : userId
    ? await findEmployeeByUserId(String(userId), undefined, 'identity')
    : null

  const rooms = ['ADMIN']
  if (employee) {
    if (employee.departmentId && !isEmployeeManager(employee)) rooms.push(`department:${employee.departmentId}`)
    rooms.push(`employee:${employee.id}`)
    if (employee.user_id) rooms.push(`user:${employee.user_id}`)
  }
  return rooms
}
