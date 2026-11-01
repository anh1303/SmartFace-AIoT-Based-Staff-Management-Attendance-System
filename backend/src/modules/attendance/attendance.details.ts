/** Per-checkout evidence. Daily half-shift wages are credited once, at the
 * checkout that first crosses the half-shift threshold, never once per pair. */
export function annotatePairCredits<T extends { start: string; end: string }>(pairs: T[], context: {
  start: string; end: string; scheduledSeconds: number; workingHours: number; candidateHours: number; off: boolean; requiredNumerator?: number; requiredDenominator?: number
}) {
  let cumulative = 0
  let credited = false
  const eligible = !context.off && context.scheduledSeconds > 0 && context.workingHours > 0
  return pairs.map(pair => {
    const from = +new Date(pair.start), to = +new Date(pair.end)
    const actual = !context.off && context.scheduledSeconds > 0 ? Math.max(0, (Math.min(to, +new Date(context.end)) - Math.max(from, +new Date(context.start))) / 1000) : 0
    const overtime = !context.off && context.scheduledSeconds > 0 ? Math.max(0, (to - Math.max(from, +new Date(context.end))) / 1000) : 0
    cumulative += actual
    const numerator = context.requiredNumerator ?? 1, denominator = context.requiredDenominator ?? 2
    const legacy = numerator === 1 && denominator === 2
    const creditNow = eligible && !credited && cumulative * denominator >= context.scheduledSeconds * numerator
    const creditReason = context.off ? 'OFF' : context.scheduledSeconds <= 0 ? 'NO_SHIFT' : !eligible ? legacy ? 'UNDER_HALF_SHIFT' : 'UNDER_MINIMUM_SHIFT' : creditNow ? legacy ? 'HALF_SHIFT_REACHED' : 'MINIMUM_SHIFT_REACHED' : credited ? 'FULL_SHIFT_ALREADY_CREDITED' : legacy ? 'HALF_SHIFT_NOT_YET_REACHED' : 'MINIMUM_SHIFT_NOT_YET_REACHED'
    if (creditNow) credited = true
    return { ...pair,
      actual_in_shift_seconds: actual, actual_overtime_seconds: overtime,
      regular_seconds: eligible ? actual : 0,
      overtime_seconds: eligible && context.candidateHours > 0 ? overtime : 0,
      counted: eligible && (actual > 0 || context.candidateHours > 0 && overtime > 0),
      credited_regular_seconds: creditNow ? context.workingHours * 3600 : 0,
      credit_reason: creditReason,
    }
  })
}

/** Upgrade display metadata from a frozen/legacy summary without changing its
 * saved wages, decisions, policy, locks or database contents. */
export function projectAttendanceDetails(value: unknown, workingHours: number, candidateHours: number) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const details = value as Record<string, unknown>
  if (!Array.isArray(details.pairs) || typeof details.scheduledStart !== 'string' || typeof details.scheduledEnd !== 'string') return value
  return { ...details, pairs: annotatePairCredits(details.pairs, {
    start: details.scheduledStart, end: details.scheduledEnd,
    scheduledSeconds: Number(details.scheduledShiftSeconds || 0), workingHours, candidateHours, off: details.off === true,
    requiredNumerator: Number(details.minimumShiftNumerator || 1), requiredDenominator: Number(details.minimumShiftDenominator || 2),
  }), details_version: 3 }
}
