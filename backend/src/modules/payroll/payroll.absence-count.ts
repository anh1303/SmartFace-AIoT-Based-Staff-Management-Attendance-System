/** Count the absences included in payroll only when every elapsed working shift has a summary. */
export function approvedAbsenceCount(
  adjustments: Array<{ kind: string }>,
  shifts: Array<{ work_date: Date; shift_type: string | null }>,
  summaries: Array<{ work_date: Date }>,
  beforeDate: string,
): number | null {
  const summarized = new Set(summaries.map(row => row.work_date.toISOString().slice(0, 10)))
  const missing = shifts.some(shift => {
    const date = shift.work_date.toISOString().slice(0, 10)
    return shift.shift_type !== 'OFF' && date < beforeDate && !summarized.has(date)
  })
  return missing ? null : adjustments.filter(row => row.kind === 'ABSENCE').length
}
