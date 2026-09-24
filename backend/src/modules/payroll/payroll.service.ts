import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'
import { PAYROLL_STATUS, EMPLOYEE_STATUS, type PayrollStatus } from '../../common/constants.js'

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

export function formatPayrollRecord(record: any) {
  const hourly_rate = Number(record.hourly_rate || 0)
  const total_working_hours = Number(record.total_working_hours || 0)
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
<<<<<<< Updated upstream
    status: (record.status === PAYROLL_STATUS.CONFIRMED || record.status === PAYROLL_STATUS.FINALIZED ? PAYROLL_STATUS.FINALIZED : PAYROLL_STATUS.PENDING) as PayrollStatus,
=======
    status: (record.status === 'CONFIRMED' || record.status === 'FINALIZED' ? 'FINALIZED' : 'PENDING') as 'PENDING' | 'FINALIZED',
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
    description: policy.description || 'Chính sách áp dụng chuẩn từ hệ thống',
=======
    description: policy.description || 'Chính sách áp dụng chuẩn: Thưởng OT 1.5x, Phạt đi trễ 50.000 ₫/h',
>>>>>>> Stashed changes
  }
}

export async function updateBonusPenalty(data: {
  overtime_rate?: number
  late_early_penalty?: number
  description?: string
}) {
  const existing = await prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
<<<<<<< Updated upstream
  let updatedPolicy = null

  if (existing) {
    updatedPolicy = await prisma.bonusPenalty.update({
=======
  if (existing) {
    const updated = await prisma.bonusPenalty.update({
>>>>>>> Stashed changes
      where: { id: existing.id },
      data: {
        ...(data.overtime_rate !== undefined ? { overtime_rate: data.overtime_rate } : {}),
        ...(data.late_early_penalty !== undefined ? { late_early_penalty: data.late_early_penalty } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        updated_at: new Date(),
      },
    })
<<<<<<< Updated upstream
  } else {
    updatedPolicy = await prisma.bonusPenalty.create({
      data: {
        overtime_rate: data.overtime_rate ?? 1.5,
=======
    return {
      id: updated.id,
      overtime_rate: Number(updated.overtime_rate),
      late_early_penalty: Number(updated.late_early_penalty),
      description: updated.description || '',
    }
  } else {
    const created = await prisma.bonusPenalty.create({
      data: {
        overtime_rate: data.overtime_rate ?? 100000,
>>>>>>> Stashed changes
        late_early_penalty: data.late_early_penalty ?? 50000,
        description: data.description || 'Quy định thưởng phạt áp dụng năm 2026',
      },
    })
<<<<<<< Updated upstream
  }

  // Tự động tính toán lại net_salary cho toàn bộ bản ghi bảng lương chưa chốt (PENDING) khi chính sách thay đổi
  const overtimeRate = Number(updatedPolicy.overtime_rate)
  const latePenaltyRate = Number(updatedPolicy.late_early_penalty)

  const pendingRecords = await prisma.payrollRecord.findMany({
    where: { status: PAYROLL_STATUS.PENDING },
  })

  await Promise.all(
    pendingRecords.map(async (record) => {
      const hourly_rate = Number(record.hourly_rate || 100000)
      const total_working_hours = Number(record.total_working_hours || 0)
      const total_overtime = Number(record.total_overtime || 0)
      const total_late_early = Number(record.total_late_early || 0)
      const allowance = Number(record.allowance || 0)

      const overtimePay = overtimeRate <= 10
        ? total_overtime * hourly_rate * overtimeRate
        : total_overtime * overtimeRate

      const latePenaltyDeduction = latePenaltyRate <= 10
        ? total_late_early * hourly_rate * latePenaltyRate
        : total_late_early * latePenaltyRate

      const net_salary = Math.max(
        0,
        Math.round(hourly_rate * total_working_hours + overtimePay - latePenaltyDeduction + allowance),
      )

      return prisma.payrollRecord.update({
        where: { id: record.id },
        data: { net_salary, updated_at: new Date() },
      })
    }),
  )

  return {
    id: updatedPolicy.id,
    overtime_rate: Number(updatedPolicy.overtime_rate),
    late_early_penalty: Number(updatedPolicy.late_early_penalty),
    description: updatedPolicy.description || '',
=======
    return {
      id: created.id,
      overtime_rate: Number(created.overtime_rate),
      late_early_penalty: Number(created.late_early_penalty),
      description: created.description || '',
    }
>>>>>>> Stashed changes
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
    hourly_rate?: number
    allowance?: number
    total_overtime?: number
    total_late_early?: number
    net_salary?: number
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

  const hourly_rate = updates.hourly_rate !== undefined ? updates.hourly_rate : Number(record.hourly_rate)
  const allowance = updates.allowance !== undefined ? updates.allowance : Number(record.allowance)
  const total_overtime = updates.total_overtime !== undefined ? updates.total_overtime : Number(record.total_overtime)
  const total_late_early = updates.total_late_early !== undefined ? updates.total_late_early : Number(record.total_late_early)
  const total_working_hours = Number(record.total_working_hours || 0)

<<<<<<< Updated upstream
  // Ưu tiên lấy chính sách thưởng/phạt mới nhất từ Database
  const bonusPenalty = await getBonusPenalty()
  const overtimeRate = bonusPenalty.overtime_rate
  const latePenaltyRate = bonusPenalty.late_early_penalty
=======
  const bonusPenalty = await prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
  const overtimeRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5
  const latePenaltyRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000
>>>>>>> Stashed changes

  const overtimePay = overtimeRate <= 10 ? total_overtime * hourly_rate * overtimeRate : total_overtime * overtimeRate
  const latePenaltyDeduction = latePenaltyRate <= 10 ? total_late_early * hourly_rate * latePenaltyRate : total_late_early * latePenaltyRate

  const net_salary = updates.net_salary !== undefined
    ? updates.net_salary
    : Math.max(0, Math.round(hourly_rate * total_working_hours + overtimePay - latePenaltyDeduction + allowance))

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
        include: { department: true }
      }
    }
  })

  return formatPayrollRecord(updated)
}

export async function finalizePeriod(period: string) {
  await prisma.payrollRecord.updateMany({
    where: { payroll_period: period },
    data: { status: PAYROLL_STATUS.FINALIZED, updated_at: new Date() },
  })
  return list(period)
}

export async function unlockPeriod(period: string) {
  await prisma.payrollRecord.updateMany({
    where: { payroll_period: period },
    data: { status: PAYROLL_STATUS.PENDING, updated_at: new Date() },
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
<<<<<<< Updated upstream
    : await prisma.employee.findMany({ where: { status: EMPLOYEE_STATUS.ACTIVE } })
=======
    : await prisma.employee.findMany({ where: { status: 'ACTIVE' } })
>>>>>>> Stashed changes

  const [yearStr, monthStr] = payroll_period.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0))

<<<<<<< Updated upstream
  // Ưu tiên lấy chính sách thưởng/phạt từ Database trước
  const bonusPenalty = await getBonusPenalty()
  const overtimeRate = bonusPenalty.overtime_rate
  const latePenaltyRate = bonusPenalty.late_early_penalty

  const results = await Promise.all(
    employees.map(async (emp) => {
      // Kiểm tra xem đã có bản ghi bảng lương trước đó trong DB chưa
      const existingRecord = await prisma.payrollRecord.findUnique({
        where: {
          employeeId_payroll_period: { employeeId: emp.id, payroll_period },
        },
      })

      // 1 & 2. Lấy dữ liệu thực tế từ daily_attendance_summary và cộng dồn số giờ làm việc thực tế trong tháng
      const attendanceSummaries = await prisma.daily_attendance_summary.findMany({
        where: {
          employee_id: emp.id,
          work_date: { gte: periodStart, lt: periodEnd },
        },
      })

      const actualMonthWorkingHours = attendanceSummaries.reduce(
        (sum, s) => sum + Number(s.total_working_hours || 0),
        0,
      )
      const totalOvertimeSec = attendanceSummaries.reduce((sum, s) => sum + (s.overtime || 0), 0)
      const totalLateEarlySec = attendanceSummaries.reduce((sum, s) => sum + (s.late_early || 0), 0)

=======
  const bonusPenalty = await prisma.bonusPenalty.findFirst({ orderBy: { id: 'desc' } })
  const overtimeRate = bonusPenalty ? Number(bonusPenalty.overtime_rate) : 1.5
  const latePenaltyRate = bonusPenalty ? Number(bonusPenalty.late_early_penalty) : 50000

  const results = await Promise.all(
    employees.map(async (emp) => {
      // 1 & 2. Lấy dữ liệu thực tế từ daily_attendance_summary và cộng dồn số giờ làm việc thực tế trong tháng
      const attendanceSummaries = await prisma.daily_attendance_summary.findMany({
        where: {
          employee_id: emp.id,
          work_date: { gte: periodStart, lt: periodEnd },
        },
      })

      const actualMonthWorkingHours = attendanceSummaries.reduce(
        (sum, s) => sum + Number(s.total_working_hours || 0),
        0,
      )
      const totalOvertimeSec = attendanceSummaries.reduce((sum, s) => sum + (s.overtime || 0), 0)
      const totalLateEarlySec = attendanceSummaries.reduce((sum, s) => sum + (s.late_early || 0), 0)

>>>>>>> Stashed changes
      const total_working_hours = Number(actualMonthWorkingHours.toFixed(2))
      const total_overtime = Number((totalOvertimeSec / 3600).toFixed(2))
      const total_late_early = Number((totalLateEarlySec / 3600).toFixed(2))

<<<<<<< Updated upstream
      // 3. Ưu tiên lấy đơn giá lương (hourly_rate) và phụ cấp (allowance) từ DB của nhân viên/bảng lương đã lưu
      const hourly_rate = Number(emp.hourly_rate || existingRecord?.hourly_rate || 100000)
      const allowance = existingRecord ? Number(existingRecord.allowance) : 1500000
=======
      // 3. Tính toán tiền lương theo đơn giá lương theo giờ (hourly_rate) nhân với tổng giờ làm thực tế
      const hourly_rate = Number(emp.hourly_rate || 100000)
      const allowance = 1500000
>>>>>>> Stashed changes

      const overtimePay = overtimeRate <= 10
        ? total_overtime * hourly_rate * overtimeRate
        : total_overtime * overtimeRate

      const latePenaltyDeduction = latePenaltyRate <= 10
        ? total_late_early * hourly_rate * latePenaltyRate
        : total_late_early * latePenaltyRate

      const baseSalaryTotal = hourly_rate * total_working_hours
      const net_salary = Math.max(0, Math.round(baseSalaryTotal + overtimePay - latePenaltyDeduction + allowance))

<<<<<<< Updated upstream
      // 4. Lưu dữ liệu tính toán từ DB vào payroll_records
=======
      // 4. Lưu con số giờ làm thực tế và tiền lương vào payroll_records
>>>>>>> Stashed changes
      return prisma.payrollRecord.upsert({
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
<<<<<<< Updated upstream
          status: PAYROLL_STATUS.PENDING,
=======
          status: 'PENDING',
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
          status: PAYROLL_STATUS.PENDING,
=======
          status: 'PENDING',
>>>>>>> Stashed changes
        },
        include: {
          employee: {
            include: { department: true }
          }
        }
      })
    }),
  )

  return results.map(formatPayrollRecord)
}

