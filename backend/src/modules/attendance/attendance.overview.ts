interface StoredDay {
  date: string
  total_working_hours: number
  overtime: number
  late_early: number
  status: string
}

/** Totals of saved attendance decisions, never a recalculation of scan evidence. */
export function summarizeEmployeeMonth(days: StoredDay[], today: string) {
  const period = today.slice(0, 7)
  const current = days.filter(day => day.date >= `${period}-01` && day.date <= today)
  const sum = (field: 'total_working_hours' | 'overtime' | 'late_early') =>
    current.length ? Math.round(current.reduce((total, day) => total + Number(day[field] || 0), 0) * 100) / 100 : null
  return {
    period,
    through_date: today,
    work_days: current.length ? new Set(current.filter(day => day.total_working_hours > 0).map(day => day.date)).size : null,
    working_hours: sum('total_working_hours'),
    overtime_hours: sum('overtime'),
    late_early_hours: sum('late_early'),
    absent_days: current.length ? new Set(current.filter(day => day.status === 'ABSENT').map(day => day.date)).size : null,
  }
}
