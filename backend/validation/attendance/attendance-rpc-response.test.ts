import { expect, it } from 'vitest'
import { compactAttendanceRpcResponse } from '../../src/modules/attendance/attendance.rpc-response.js'
it('keeps the committed decision while removing large inline images', () => {
  const avatar_url = 'data:image/jpeg;base64,' + 'A'.repeat(400_000)
  const source = {
    success: true, matched: true, door_open: true, event_id: 'confirmed-event', mode: 'CHECK_IN',
    employee: { id: 'a', full_name: 'Alice', employee_code: 'A', avatar_url },
    attendance: { id: '123', status: 'VALID', type: 'CHECK_IN', ignored: false, avatar_url },
  }
  const result = compactAttendanceRpcResponse(source)
  expect(JSON.stringify(result).length).toBeLessThan(2048)
  expect(result).toMatchObject({ success: true, door_open: true, event_id: source.event_id,
    attendance: { id: '123', status: 'VALID', ignored: false }, employee: { full_name: 'Alice' } })
  expect(source.employee.avatar_url).toBe(avatar_url)
})
it('preserves cooldown and denial so they never become permission to open', () => {
  const result = compactAttendanceRpcResponse({ success: true, ignored: true, cooldown: true,
    door_open: false, retry_after_seconds: 5, attendance: { ignored: true, access_denied: true } })
  expect(result).toMatchObject({ ignored: true, cooldown: true, door_open: false,
    retry_after_seconds: 5, attendance: { ignored: true, access_denied: true } })
})
