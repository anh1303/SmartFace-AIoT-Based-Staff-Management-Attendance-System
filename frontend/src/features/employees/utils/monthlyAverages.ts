type Shift = { date: string; shift_type: string };
type Summary = { date: string; status: string; total_working_hours: number; overtime: number; late_early: number; is_absent?: boolean };
type Payroll = { period: string; payroll_period?: string; net_salary: number };

export function calculateMonthlyAverages(shifts: Shift[], summaries: Summary[], payroll: Payroll[], currentMonth: string) {
  const shiftMonths = new Map<string, number>();
  for (const shift of shifts) {
    const month = shift.date.slice(0, 7);
    if (month > currentMonth) continue;
    shiftMonths.set(month, (shiftMonths.get(month) ?? 0) + (shift.shift_type === 'OFF' ? 0 : 1));
  }
  const months = new Map<string, { hours: number; overtime: number; lateEarly: number; absence: number; onTime: number; classified: number }>();
  for (const day of summaries) {
    const month = day.date.slice(0, 7);
    if (month > currentMonth || day.status === 'SCHEDULED' || day.status === 'OFF') continue;
    const item = months.get(month) ?? { hours: 0, overtime: 0, lateEarly: 0, absence: 0, onTime: 0, classified: 0 };
    item.hours += Number(day.total_working_hours);
    item.overtime += Number(day.overtime);
    item.lateEarly += Number(day.late_early);
    item.absence += Number(day.is_absent || day.status === 'ABSENT');
    if (['PRESENT', 'EARLY_LEAVE', 'LATE', 'LATE_AND_EARLY'].includes(day.status)) {
      item.classified++;
      if (day.status === 'PRESENT' || day.status === 'EARLY_LEAVE') item.onTime++;
    }
    months.set(month, item);
  }
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const rows = [...months.values()];
  return {
    shifts: average([...shiftMonths.values()]),
    hours: average(rows.map(row => row.hours)),
    punctuality: average(rows.filter(row => row.classified > 0).map(row => row.onTime * 100 / row.classified)),
    overtime: average(rows.map(row => row.overtime)),
    lateEarly: average(rows.map(row => row.lateEarly)),
    absence: average(rows.map(row => row.absence)),
    salary: average(payroll.filter(row => (row.period || row.payroll_period || '') <= currentMonth).map(row => Number(row.net_salary))),
  };
}
