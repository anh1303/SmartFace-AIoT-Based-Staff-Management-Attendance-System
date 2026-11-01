import { prisma } from '../../config/database.js'

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

export async function findEmployeeByEmail(email: string) {
  return prisma.employee.findFirst({ where: { email } })
}

