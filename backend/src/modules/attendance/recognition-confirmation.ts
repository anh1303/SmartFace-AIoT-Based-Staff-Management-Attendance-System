/** Ephemeral evidence only; attendance remains in the normal transactional writer. */
const TTL_MS = 30_000
const MAX_SESSIONS = 512
const sessions = new Map<string, {employee: string | null; count: number; seen: Set<string>; updated: number}>()

export function observeRecognition(device: string, event: string, recognition: string, employee: string | null, now = Date.now()) {
  for (const [key, state] of sessions) if (now - state.updated >= TTL_MS) sessions.delete(key)
  const key = JSON.stringify([device, event])
  let state = sessions.get(key)
  if (!state) {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!)
    state = {employee: null, count: 0, seen: new Set(), updated: now}
    sessions.set(key, state)
  }
  if (!state.seen.has(recognition)) {
    state.count = employee ? (state.employee === employee ? state.count + 1 : 1) : 0
    state.employee = employee
    state.seen.add(recognition)
    if (state.seen.size > 64) state.seen.delete(state.seen.values().next().value!)
    state.updated = now
  }
  const count = employee && state.employee === employee ? state.count : 0
  const required = Math.max(1, Number.parseInt(process.env.ATTENDANCE_STABLE_COUNT || '3', 10) || 3)
  return {count, required, ready: count >= required}
}
