import { AsyncLocalStorage } from 'node:async_hooks'
import { performance } from 'node:perf_hooks'

const traces = new AsyncLocalStorage<{ event_id: string; started: number; stages: Record<string, number>; queries: Array<{ action: string; ms: number }> }>()

export async function traceAttendance<T>(eventId: unknown, run: () => Promise<T>): Promise<T> {
  if (process.env.ATTENDANCE_PERF_LOG !== 'true') return run()
  const trace = { event_id: typeof eventId === 'string' ? eventId.slice(0, 120) : '', started: performance.now(), stages: {}, queries: [] }
  return traces.run(trace, async () => {
    try { return await run() }
    finally { console.info('[AttendanceTiming]', JSON.stringify({ ...trace, started: undefined, total_ms: Math.round(performance.now() - trace.started) })) }
  })
}

export async function timeAttendanceStage<T>(name: string, run: () => Promise<T>): Promise<T> {
  const trace = traces.getStore()
  if (!trace) return run()
  const started = performance.now()
  try { return await run() }
  finally { trace.stages[name] = Math.round(performance.now() - started) }
}

// Record operation names and durations only: never SQL, vectors, names or credentials.
export async function timeAttendanceQuery<T>(action: string, run: () => Promise<T>): Promise<T> {
  const trace = traces.getStore()
  if (!trace) return run()
  const started = performance.now()
  try { return await run() }
  finally { if (trace.queries.length < 100) trace.queries.push({ action, ms: Math.round(performance.now() - started) }) }
}
