import { prisma } from '../config/database.js'

const VN_TIMEZONE = 'Asia/Ho_Chi_Minh'

/**
 * Returns date formatted as YYYY-MM-DD in Vietnam local timezone (+07:00).
 */
export function formatVNDateISO(dateInput?: Date | string | number | null): string {
  if (!dateInput) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput
    if (isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    }
    return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { timeZone: VN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  }
}

/**
 * Returns today's YYYY-MM-DD string in Vietnam timezone (+07:00).
 */
export function getTodayVNString(): string {
  return formatVNDateISO(new Date())
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function buildIdOrCodeWhere(idOrCode: string) {
  if (UUID_REGEX.test(idOrCode)) {
    return { id: idOrCode }
  }
  return { employee_code: idOrCode }
}

export async function generateUniqueEmployeeCode(): Promise<string> {
  // 1. Tự động đồng bộ SEQUENCE tới giá trị lớn nhất hiện có nếu sequence chưa được khởi tạo (DML, safe)
  const seqState = await prisma.$queryRaw<Array<{ last_value: bigint; is_called: boolean }>>`
    SELECT last_value, is_called FROM employee_code_seq;
  `.catch(() => [])

  if (seqState.length > 0 && !seqState[0].is_called && Number(seqState[0].last_value) === 1) {
    await prisma.$executeRawUnsafe(`
      SELECT setval('employee_code_seq', GREATEST((
        SELECT COALESCE(MAX(CAST(SUBSTRING(employee_code FROM 4) AS INTEGER)), 0)
        FROM employees
        WHERE employee_code ~ '^NV-[0-9]+$'
      ) + 1, 1), false);
    `).catch(() => {})
  }

  // 2. Sử dụng nextval('employee_code_seq') đảm bảo nguyên tố (atomic), không bao giờ cấp trùng số
  while (true) {
    const res = await prisma.$queryRaw<Array<{ nextval: bigint }>>`SELECT nextval('employee_code_seq') as nextval;`
    const val = Number(res[0]?.nextval || 1)
    const candidate = `NV-${String(val).padStart(3, '0')}`

    const existing = await prisma.employee.findUnique({ where: { employee_code: candidate } })
    if (!existing) {
      return candidate
    }
  }
}

export interface SalaryCalculationInput {
  hourly_rate: number
  total_working_hours: number
  total_overtime: number
  total_late_early: number
  allowance: number
  overtime_rate: number
  late_early_penalty: number
}

/**
 * Pure Function để tính lương thực lĩnh (net_salary) dùng chung thống nhất toàn hệ thống.
 */
export function calculateNetSalary(params: SalaryCalculationInput): number {
  const {
    hourly_rate,
    total_working_hours,
    total_overtime,
    total_late_early,
    allowance,
    overtime_rate,
    late_early_penalty,
  } = params

  const overtimePay = overtime_rate <= 10
    ? total_overtime * hourly_rate * overtime_rate
    : total_overtime * overtime_rate

  const latePenaltyDeduction = late_early_penalty <= 10
    ? total_late_early * hourly_rate * late_early_penalty
    : total_late_early * late_early_penalty

  const baseSalaryTotal = hourly_rate * total_working_hours

  return Math.max(0, Math.round(baseSalaryTotal + overtimePay - latePenaltyDeduction + allowance))
}