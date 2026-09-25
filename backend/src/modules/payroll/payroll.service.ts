import { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, calculateNetSalary } from '../../common/utils.js'
import { logAction } from '../audit-logs/audit.service.js'
import type { PayrollStatus } from '../../common/constants.js'


function parseShiftHours(startTime?: string | Date | null, endTime?: string | Date | null): number {
  if (!startTime || !endTime) return 8
  if (startTime instanceof Date && endTime instanceof Date) {
    const sMin = startTime.getUTCHours() * 60 + startTime.getUTCMinutes()
    const eMin = endTime.getUTCHours() * 60 + endTime.getUTCMinutes()
    return Math.max(0, (eMin - sMin) / 60)
  }
  const sStr = String(startTime)
  const eStr = String(endTime)
  const [sh = 8, sm = 0] = sStr.split(':').map(Number)
  const [eh = 17, em = 30] = eStr.split(':').map(Number)
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60)
}

export interface RawPayrollRecord {
  id: string | bigint
  payroll_period: string
  employeeId: string
  hourly_rate?: { toString(): string } | number | string | null
  total_working_hours?: { toString(): string } | number | string | null
  total_overtime?: { toString(): string } | number | string | null
  total_late_early?: { toString(): string } | number | string | null
  allowance?: { toString(): string } | number | string | null
  net_salary?: { toString(): string } | number | string | null
  status?: string | null
  employee?: { employee_code?: string; full_name?: string; department?: { name?: string } | null } | null
}

export function formatPayrollRecord(record: RawPayrollRecord) {
  const hourly_rate = Number(record.hourly_rate || 0)
  const total_working_hours = Number(record.total_working_hours) > 0 ? Number(record.total_working_hours) : 176
  const total_overtime = Number(record.total_overtime || 0)
  const total_late_early = Number(record.total_late_early || 0)
  const allowance = Number(record.allowance || 0)
  const net_salary = Number(record.net_salary || 0)
  return {
    id: record.id.toString(),
    payroll_id: `PR-${record.payroll_period.replace('-', '')}-${record.id.toString().padStart(3, '0')}`,
    employee_id: record.employee?.employee_code || record.employeeId,
    employee_name: record.employee?.full_name || '',
    department: record.employee?.department?.name || '',
    period: record.payroll_period,
    hourly_rate,
    total_working_hours,
    total_overtime,
    total_late_early,
    allowance,
    net_salary,
    status: (record.status === 'CONFIRMED' || record.status === 'FINALIZED' ? 'FINALIZED' : 'PENDING') as 'PENDING' | 'FINALIZED',
  }
}

export async function getBonusPenalty() {
  const policy = await prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
  if (!policy) {
    return {
      id: 1,
      overtime_rate: 1.5,
      late_early_penalty: 50000,
      description: 'Chính sách áp dụng chuẩn: Thưởng OT 1.5x, Phạt đi trễ 50.000 ₫/h',
    }
  }
  return {
    id: policy.id,
    overtime_rate: Number(policy.overtime_rate),
    late_early_penalty: Number(policy.late_early_penalty),
    description: policy.description || 'Chính sách áp dụng chuẩn từ hệ thống',
  }
}

export async function updateBonusPenalty(data: {
  overtime_rate?: number
  late_early_penalty?: number
  description?: string
}, actorUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
    let updatedPolicy = null

    if (existing) {
      updatedPolicy = await tx.bonusPenalty.update({
        where: { id: existing.id },
        data: {
          ...(data.overtime_rate !== undefined ? { overtime_rate: data.overtime_rate } : {}),
          ...(data.late_early_penalty !== undefined ? { late_early_penalty: data.late_early_penalty } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          updated_at: new Date(),
        },
      })
    } else {
      updatedPolicy = await tx.bonusPenalty.create({
        data: {
          overtime_rate: data.overtime_rate ?? 1.5,
          late_early_penalty: data.late_early_penalty ?? 50000,
          description: data.description || 'Quy định thưởng phạt áp dụng năm 2026',
        },
      })
    }

    // 1. Loại bỏ hoàn toàn N+1 query: Update nguyên khối trong transaction bằng SQL atomic
    const overtimeRate = Number(updatedPolicy.overtime_rate)
    const latePenaltyRate = Number(updatedPolicy.late_early_penalty)

    await tx.$executeRaw`
      UPDATE payroll_records
      SET
        net_salary = GREATEST(0, ROUND(
          hourly_rate * CASE WHEN total_working_hours > 0 THEN total_working_hours ELSE 176 END
          + CASE WHEN ${overtimeRate} <= 10 THEN total_overtime * hourly_rate * ${overtimeRate} ELSE total_overtime * ${overtimeRate} END
          - CASE WHEN ${latePenaltyRate} <= 10 THEN total_late_early * hourly_rate * ${latePenaltyRate} ELSE total_late_early * ${latePenaltyRate} END
          + allowance
        )),
        updated_at = NOW()
      WHERE status = 'PENDING'
    `

    await logAction({
      userId: actorUserId,
      action: 'UPDATE_BONUS_PENALTY',
      target_table: 'bonus_penalty',
      record_id: String(updatedPolicy.id),
      old_values: existing
        ? {
          overtime_rate: existing.overtime_rate,
          late_early_penalty: existing.late_early_penalty,
          description: existing.description,
        }
        : undefined,
      new_values: {
        overtime_rate: updatedPolicy.overtime_rate,
        late_early_penalty: updatedPolicy.late_early_penalty,
        description: updatedPolicy.description,
      },
    })

    return {
      id: updatedPolicy.id,
      overtime_rate: Number(updatedPolicy.overtime_rate),
      late_early_penalty: Number(updatedPolicy.late_early_penalty),
      description: updatedPolicy.description || '',
    }
  })
}

export async function list(payroll_period?: string, employeeIdOrCode?: string) {
  const where: Prisma.PayrollRecordWhereInput = {}
  if (payroll_period) where.payroll_period = payroll_period
  if (employeeIdOrCode) {
    where.employee = buildIdOrCodeWhere(employeeIdOrCode)
  }
  const records = await prisma.payrollRecord.findMany({
    where,
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
    hourly_rate?: number
    allowance?: number
    total_working_hours?: number
    working_hours?: number
    total_overtime?: number
    total_late_early?: number
    net_salary?: number
    status?: PayrollStatus
  },
  actorUserId?: string,
) {
  // 2. Tối ưu O(1) query trực tiếp theo ID hoặc parse format PR-YYYYMM-XXX, loại bỏ fetch toàn bộ bảng
  let record = null
  const prMatch = idOrPayrollId.match(/^PR-(\d{4})(\d{2})-(\d+)$/i)
  if (prMatch) {
    const recordId = BigInt(parseInt(prMatch[3], 10))
    const period = `${prMatch[1]}-${prMatch[2]}`
    record = await prisma.payrollRecord.findFirst({
      where: { id: recordId, payroll_period: period },
      include: { employee: true },
    })
  } else if (/^\d+$/.test(idOrPayrollId)) {
    record = await prisma.payrollRecord.findUnique({
      where: { id: BigInt(idOrPayrollId) },
      include: { employee: true },
    })
  }

  if (!record) throw new AppError(404, 'Payroll record not found')

  const hourly_rate = updates.hourly_rate !== undefined ? updates.hourly_rate : Number(record.hourly_rate)
  const allowance = updates.allowance !== undefined ? updates.allowance : Number(record.allowance)
  const total_overtime = updates.total_overtime !== undefined ? updates.total_overtime : Number(record.total_overtime)
  const total_late_early = updates.total_late_early !== undefined ? updates.total_late_early : Number(record.total_late_early)
  const total_working_hours = updates.total_working_hours !== undefined
    ? updates.total_working_hours
    : (updates.working_hours !== undefined
      ? updates.working_hours
      : (Number(record.total_working_hours) > 0 ? Number(record.total_working_hours) : 176))

  const bonusPenalty = await getBonusPenalty()
  const overtimeRate = bonusPenalty.overtime_rate
  const latePenaltyRate = bonusPenalty.late_early_penalty

  const net_salary = calculateNetSalary({
    hourly_rate,
    total_working_hours,
    total_overtime,
    total_late_early,
    allowance,
    overtime_rate: overtimeRate,
    late_early_penalty: latePenaltyRate,
  })

  const updated = await prisma.payrollRecord.update({
    where: { id: record.id },
    data: {
      hourly_rate,
      total_working_hours,
      total_overtime,
      total_late_early,
      allowance,
      net_salary,
      ...(updates.status ? { status: updates.status } : {}),
      updated_at: new Date(),
    },
    include: {
      employee: {
        include: { department: true },
      },
    },
  })

  await logAction({
    userId: actorUserId,
    action: 'UPDATE_PAYROLL_RECORD',
    target_table: 'payroll_records',
    record_id: String(record.id),
    old_values: {
      hourly_rate: record.hourly_rate,
      total_working_hours: record.total_working_hours,
      total_overtime: record.total_overtime,
      total_late_early: record.total_late_early,
      allowance: record.allowance,
      net_salary: record.net_salary,
      status: record.status,
    },
    new_values: {
      hourly_rate: updated.hourly_rate,
      total_working_hours: updated.total_working_hours,
      total_overtime: updated.total_overtime,
      total_late_early: updated.total_late_early,
      allowance: updated.allowance,
      net_salary: updated.net_salary,
      status: updated.status,
    },
  })

  return formatPayrollRecord(updated)
}

export async function finalizePeriod(period: string, actorUserId?: string) {
  await prisma.payrollRecord.updateMany({
    where: { payroll_period: period },
    data: { status: 'FINALIZED', updated_at: new Date() },
  })

  await logAction({
    userId: actorUserId,
    action: 'FINALIZE_PAYROLL_PERIOD',
    target_table: 'payroll_records',
    record_id: period,
    new_values: { period, status: 'FINALIZED' },
  })

  return list(period)
}

export async function unlockPeriod(period: string, actorUserId?: string) {
  await prisma.payrollRecord.updateMany({
    where: { payroll_period: period },
    data: { status: 'PENDING', updated_at: new Date() },
  })

  await logAction({
    userId: actorUserId,
    action: 'UNLOCK_PAYROLL_PERIOD',
    target_table: 'payroll_records',
    record_id: period,
    new_values: { period, status: 'PENDING' },
  })

  return list(period)
}

export async function generate(payroll_period: string, employeeId?: string, actorUserId?: string) {
  const [yearStr, monthStr] = payroll_period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)

  // 4. Khắc phục lỗi Timezone khi so sánh với work_date (@db.Date không lưu timezone):
  // Khởi tạo mốc UTC 00:00:00 đầu tháng và đầu tháng tiếp theo chuẩn xác
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  const periodStart = new Date(`${payroll_period}-01T00:00:00.000Z`)
  const periodEnd = new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`)

  const bonusPenalty = await getBonusPenalty()
  const overtimeRate = bonusPenalty.overtime_rate
  const latePenaltyRate = bonusPenalty.late_early_penalty

  // 3. Đảm bảo tính Transaction và Idempotency cho toàn bộ chu kỳ tính lương
  return prisma.$transaction(async (tx) => {
    const employees = employeeId
      ? [
        await tx.employee.findFirstOrThrow({
          where: buildIdOrCodeWhere(employeeId),
        }),
      ]
      : await tx.employee.findMany({ where: { status: 'ACTIVE' } })

    const upsertPromises = employees.map(async (emp) => {
      const existingRecord = await tx.payrollRecord.findUnique({
        where: {
          employeeId_payroll_period: { employeeId: emp.id, payroll_period },
        },
      })

      // 1 & 2. Lấy dữ liệu thực tế từ daily_attendance_summary và cộng dồn số giờ làm việc thực tế trong tháng
      const attendanceSummaries = await tx.daily_attendance_summary.findMany({
        where: {
          employee_id: emp.id,
          work_date: { gte: periodStart, lt: periodEnd },
        },
      })
      const actualMonthWorkingHours = attendanceSummaries.reduce(
        (sum, s) => sum + Number(s.total_working_hours || 0),
        0,
      )
      const totalOvertimeHours = attendanceSummaries.reduce(
        (sum, s) => sum + Number(s.overtime || 0),
        0,
      )
      const totalLateEarlyHours = attendanceSummaries.reduce(
        (sum, s) => sum + Number(s.late_early || 0),
        0,
      )

      // Ưu tiên giờ công thực tế, nếu chưa có log hàng ngày thì dùng chuẩn 176h
      const total_working_hours = actualMonthWorkingHours > 0
        ? Number(actualMonthWorkingHours.toFixed(2))
        : (existingRecord && Number(existingRecord.total_working_hours) > 0 ? Number(existingRecord.total_working_hours) : 176)

      const total_overtime = totalOvertimeHours > 0
        ? Number(totalOvertimeHours.toFixed(2))
        : (existingRecord ? Number(existingRecord.total_overtime || 0) : 0)

      const total_late_early = totalLateEarlyHours > 0
        ? Number(totalLateEarlyHours.toFixed(2))
        : (existingRecord ? Number(existingRecord.total_late_early || 0) : 0)

      // 3. Tính toán tiền lương theo đơn giá lương theo giờ (hourly_rate) nhân với tổng giờ làm thực tế
      const hourly_rate = Number(emp.hourly_rate || existingRecord?.hourly_rate || 100000)
      const allowance = existingRecord ? Number(existingRecord.allowance) : 1500000

      const net_salary = calculateNetSalary({
        hourly_rate,
        total_working_hours,
        total_overtime,
        total_late_early,
        allowance,
        overtime_rate: overtimeRate,
        late_early_penalty: latePenaltyRate,
      })

      // 4. Lưu con số giờ làm thực tế và tiền lương vào payroll_records
      return tx.payrollRecord.upsert({
        where: {
          employeeId_payroll_period: { employeeId: emp.id, payroll_period },
        },
        update: {
          hourly_rate,
          total_working_hours,
          total_overtime,
          total_late_early,
          allowance,
          net_salary,
          status: 'PENDING',
          updated_at: new Date(),
        },
        create: {
          employeeId: emp.id,
          payroll_period,
          hourly_rate,
          total_working_hours,
          total_overtime,
          total_late_early,
          allowance,
          net_salary,
          status: 'PENDING',
        },
        include: {
          employee: {
            include: { department: true },
          },
        },
      })
    })

    const results = await Promise.all(upsertPromises)

    await logAction({
      userId: actorUserId,
      action: 'GENERATE_PAYROLL',
      target_table: 'payroll_records',
      record_id: payroll_period,
      new_values: {
        payroll_period,
        employee_count: results.length,
        employeeId: employeeId || 'ALL',
      },
    })

    return results.map(formatPayrollRecord)
  })
}