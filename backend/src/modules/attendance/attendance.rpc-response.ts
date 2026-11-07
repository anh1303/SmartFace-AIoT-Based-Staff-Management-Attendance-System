/** Pi needs the decision and record identity; inline avatars can exceed TB's
 * REST response buffer/MQTT packet limit. Web events keep their own payloads. */
export function compactAttendanceRpcResponse(result: any) {
  const response = { ...result }
  if (response.employee) {
    const { id, employee_code, full_name } = response.employee
    response.employee = { id, employee_code, full_name }
  }
  if (response.attendance) {
    const { id, status, type, event_time, work_date, duplicate, ignored, cooldown,
      access_denied, retry_after_seconds } = response.attendance
    response.attendance = { id, status, type, event_time, work_date, duplicate,
      ignored, cooldown, access_denied, retry_after_seconds }
  }
  return response
}
