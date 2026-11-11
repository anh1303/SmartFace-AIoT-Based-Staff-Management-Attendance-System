import { afterEach, expect, it, vi } from 'vitest'
import { traceAttendance, timeAttendanceQuery, timeAttendanceStage } from '../../src/common/attendance-timing.js'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

it('keeps concurrent request timings separate and logs no query inputs or results', async () => {
  vi.stubEnv('ATTENDANCE_PERF_LOG', 'true')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  await Promise.all(['event-a', 'event-b'].map(id => traceAttendance(id, () =>
    timeAttendanceStage('match', () => timeAttendanceQuery('raw.queryRaw', async () => ({ private_vector: [1, 2, 3] }))))))
  const traces = log.mock.calls.map(call => JSON.parse(call[1]))
  expect(traces.map(trace => trace.event_id).sort()).toEqual(['event-a', 'event-b'])
  for (const trace of traces) {
    expect(trace.queries).toHaveLength(1)
    expect(trace.stages.match).toBeGreaterThanOrEqual(0)
    expect(trace).not.toHaveProperty('private_vector')
    expect(trace).not.toHaveProperty('started')
  }
})

it('preserves failures while still recording the failed operation', async () => {
  vi.stubEnv('ATTENDANCE_PERF_LOG', 'true')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  const error = new Error('query failed')
  await expect(traceAttendance('event-failed', () => timeAttendanceQuery('raw.queryRaw', async () => { throw error }))).rejects.toBe(error)
  expect(JSON.parse(log.mock.calls[0][1]).queries).toHaveLength(1)
})

it('does not log when tracing is disabled', async () => {
  vi.stubEnv('ATTENDANCE_PERF_LOG', 'false')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  expect(await traceAttendance('event', async () => 42)).toBe(42)
  expect(log).not.toHaveBeenCalled()
})
