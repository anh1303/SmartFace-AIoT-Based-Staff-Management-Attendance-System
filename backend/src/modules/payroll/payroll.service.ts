import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'

export function formatPayrollRecord(record: any) {
  const base = Number(record.base_salary || 0)
  const allowance = Number(record.allowance || 0)
  const deduction = Number(record.deduction || 0)
  const total = Number(record.total_paid || Math.max(0, base + allowance - deduction))

  return {
    id: record.id.toString(),
    payroll_id: `PR-${record.payroll_period.replace('-', '')}-${record.id.toString().padStart(3, '0')}`,
    employee_id: record.employee?.employee_code || record.employeeId,
    period: record.payroll_period,
    base_salary: base,
    allowance: allowance,
    deduction: deduction,
    total_paid: total,
    working_days: Number(record.actual_working_days || record.standard_days || 0),
    working_hours: Number(record.total_working_hours || 0),
    late_count: record.late_count || 0,
    status: (record.status === 'CONFIRMED' || record.status === 'FINALIZED' ? 'FINALIZED' : 'PENDING') as 'PENDING' | 'FINALIZED',
  }
}

export async function list(payroll_period?: string) {
  const records = await prisma.payrollRecord.findMany({
    where: payroll_period ? { payroll_period } : {},
    include: {
      employee: {
        include: { department: true },
      },
    },
    orderBy: { payroll_period: 'desc' },
  })

  return records.map(formatPayrollRecord)
}

export async function updateItem(
  idOrPayrollId: string,
  updates: {
    base_salary?: number
    allowance?: number
    deduction?: number
    status?: 'PENDING' | 'FINALIZED'
  },
) {
  let record = null

  if (/^\d+$/.test(idOrPayrollId)) {
    record = await prisma.payrollRecord.findUnique({
      where: { id: BigInt(idOrPayrollId) },
      include: { employee: true },
    })
  }

  if (!record) {
    const all = await prisma.payrollRecord.findMany({ include: { employee: true } })
    record = all.find(
      (r) =>
        r.id.toString() === idOrPayrollId ||
        `PR-${r.payroll_period.replace('-', '')}-${r.id.toString().padStart(3, '0')}` === idOrPayrollId,
    )
  }

  if (!record) throw new AppError(404, 'Payroll record not found')

  const base = updates.base_salary !== undefined ? updates.base_salary : Number(record.base_salary)
  const allowance = updates.allowance !== undefined ? updates.allowance : Number(record.allowance)
  const deduction = updates.deduction !== undefined ? updates.deduction : Number(record.deduction)
  const total_paid = Math.max(0, base + allowance - deduction)

  const updated = await prisma.payrollRecord.update({
    where: { id: record.id },
    data: {
      base_salary: base,
      allowance: allowance,
      deduction: deduction,
      total_paid: total_paid,
      ...(updates.status ? { status: updates.status } : {}),
      updated_at: new Date(),
    },
    include: { employee: true },
  })

  return formatPayrollRecord(updated)
}

export async function finalizePeriod(period: string) {
  await prisma.payrollRecord.updateMany({
    where: { payroll_period: period },
    data: { status: 'FINALIZED', updated_at: new Date() },
  })
  return list(period)
}

export async function unlockPeriod(period: string) {
  await prisma.payrollRecord.updateMany({
    where: { payroll_period: period },
    data: { status: 'PENDING', updated_at: new Date() },
  })
  return list(period)
}



export async function generate(payroll_period: string, employeeId?: string) {
  const employees = employeeId
    ? [
        await prisma.employee.findFirstOrThrow({
          where: buildIdOrCodeWhere(employeeId),
        }),
      ]
    : await prisma.employee.findMany({ where: { status: 'ACTIVE', deleted_at: null } })

  const standard_days = 22

  const results = await Promise.all(
    employees.map(async (emp) => {
      const periodStart = new Date(`${payroll_period}-01T00:00:00.000Z`)
      const periodEnd = new Date(periodStart)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      const checkIns = await prisma.attendance_logs.findMany({
        where: {
          employee_id: emp.id,
          type: 'CHECK_IN',
          event_time: { gte: periodStart, lt: periodEnd },
          status: 'VALID',
        },
        select: { event_time: true },
      })

      const uniqueDays = new Set(checkIns.map((log) => log.event_time.toISOString().slice(0, 10)))
      const actual_working_days = uniqueDays.size
      const total_working_hours = actual_working_days * 8
      const base_salary = Number(emp.base_salary || 20000000)
      const allowance = 1500000
      const deduction = 500000
      const total_paid = Math.max(0, base_salary + allowance - deduction)

      return prisma.payrollRecord.upsert({
        where: {
          employeeId_payroll_period: { employeeId: emp.id, payroll_period },
        },
        update: {
          base_salary,
          allowance,
          deduction,
          total_paid,
          standard_days,
          actual_working_days,
          total_working_hours,
          status: 'PENDING',
          updated_at: new Date(),
        },
        create: {
          employeeId: emp.id,
          payroll_period,
          base_salary,
          allowance,
          deduction,
          total_paid,
          standard_days,
          actual_working_days,
          total_working_hours,
          total_late_minutes: 0,
          total_early_leave_minutes: 0,
          late_count: 0,
          status: 'PENDING',
        },
        include: { employee: true },
      })
    }),
  )

  return results.map(formatPayrollRecord)
}
