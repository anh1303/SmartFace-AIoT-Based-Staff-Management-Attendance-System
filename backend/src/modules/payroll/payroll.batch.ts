import { Prisma } from '@prisma/client'

export interface PayrollBatchRow {
  employeeId: string
  payroll_period: string
  hourly_rate: number
  total_working_hours: number
  total_overtime: number
  total_late_early: number
  total_absence_penalty: number
  allowance: number
  net_salary: number
  overtime_rate: number
  late_penalty_rate: number
  status: 'PENDING'
  calculation_details: Prisma.InputJsonValue
}

export async function writePayrollBatch(tx: Prisma.TransactionClient, rows: PayrollBatchRow[]) {
  if (!rows.length) return []
  for (let offset = 0; offset < rows.length; offset += 250) {
    const payload = JSON.stringify(rows.slice(offset, offset + 250))
    await tx.$executeRaw(Prisma.sql`INSERT INTO payroll_records
      (employee_id, payroll_period, hourly_rate, total_working_hours, total_overtime,
       total_late_early, total_absence_penalty, allowance, net_salary,
       overtime_rate, late_penalty_rate, status, calculation_details)
      SELECT "employeeId", payroll_period, hourly_rate, total_working_hours, total_overtime,
       total_late_early, total_absence_penalty, allowance, net_salary,
       overtime_rate, late_penalty_rate, status, calculation_details
      FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(
       "employeeId" uuid, payroll_period varchar(7), hourly_rate numeric, total_working_hours numeric,
       total_overtime numeric, total_late_early numeric, total_absence_penalty numeric,
       allowance numeric, net_salary numeric, overtime_rate numeric, late_penalty_rate numeric,
       status varchar(20), calculation_details jsonb)
      ON CONFLICT (employee_id, payroll_period) DO UPDATE SET
       hourly_rate = EXCLUDED.hourly_rate, total_working_hours = EXCLUDED.total_working_hours,
       total_overtime = EXCLUDED.total_overtime, total_late_early = EXCLUDED.total_late_early,
       total_absence_penalty = EXCLUDED.total_absence_penalty, allowance = EXCLUDED.allowance,
       net_salary = EXCLUDED.net_salary, overtime_rate = EXCLUDED.overtime_rate,
       late_penalty_rate = EXCLUDED.late_penalty_rate, status = EXCLUDED.status,
       calculation_details = EXCLUDED.calculation_details, updated_at = clock_timestamp()
      WHERE payroll_records.status = 'PENDING'`)
  }
  return tx.payrollRecord.findMany({
    where: { OR: rows.map(row => ({ employeeId: row.employeeId, payroll_period: row.payroll_period })) },
  })
}
