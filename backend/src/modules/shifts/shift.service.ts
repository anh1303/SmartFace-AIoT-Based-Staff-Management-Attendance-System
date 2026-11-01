import type { Prisma } from '@prisma/client'
import {
  assertEditableDay,
  aggregateDailyAttendance,
  isAttendanceDateLocked,
  invalidateDailySummaryForShiftChange,
} from '../attendance/public.js'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, formatVNDateISO, employeeLockKey, payrollPeriodLockKey } from '../../common/utils.js'
import { logAction } from '../audit-logs/public.js'
import {
  assertCanManageEmployee,
  getEmployeeScope,
  findEmployeeByIdOrCode,
  findEmployeeByUserId,
} from '../employees/public.js'

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/**
 * 3 Ca làm việc mặc định chuẩn của toàn hệ thống.
 * Giờ bắt đầu và kết thúc là cố định và KHÔNG THỂ SỬA ĐỔI.
 */
import {
  STANDARD_SHIFT_CONFIGS,
  getDefaultShift,
  getShiftClient,
  getEmployeeShiftsByDates,
  getEmployeeShiftsByFilter,
  getEmployeeShiftsForDateRange,
  getEmployeeNearShifts,
  getEmployeeShiftsForAggregation,
  getEmployeeShiftsBeforeCutoff,
  getEmployeeShiftsForEarlySettlement,
  purgeShiftsForEarlySettlement,
  deleteShiftsForEmployee,
  getEmployeeShiftsForRecalculation,
  getActiveEmployeeShiftsWithDetails,
} from './shift.queries.js'

function formatTimeHHMM(val: unknown, fallback: string): string {
  if (!val) return fallback
  if (val instanceof Date) {
    const hours = String(val.getUTCHours()).padStart(2, '0')
    const minutes = String(val.getUTCMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  if (typeof val === 'string') {
    if (val.includes('T')) {
      const d = new Date(val)
      const hours = String(d.getUTCHours()).padStart(2, '0')
      const minutes = String(d.getUTCMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return val.slice(0, 5)
  }
  return fallback
}

function parseTimeStringToDate(timeStr?: string, fallbackStr: string = '08:00'): Date {
  const str = timeStr || fallbackStr
  const parts = str.split(':')
  const hh = (parts[0] || '08').padStart(2, '0')
  const mm = (parts[1] || '00').padStart(2, '0')
  const ss = (parts[2] || '00').padStart(2, '0')
  return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface RawShift {
  id: string | bigint
  work_date: Date | string
  work_day?: string | null
  start_time?: Date | string | null
  end_time?: Date | string | null
  shift_type?: string | null
  note?: string | null
  employee_id?: string
  employees?: { employee_code?: string; department?: { name?: string } | null } | null
}

export function formatShift(s: RawShift) {
  const dateStr = formatVNDateISO(s.work_date)

  let workDay = s.work_day
  if (!workDay && dateStr) {
    const dayIndex = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()
    workDay = DAY_NAMES[dayIndex] || 'Thứ Hai'
  }

  return {
    shift_id: s.id.toString(),
    employee_id: s.employees?.employee_code || s.employee_id,
    date: dateStr,
    work_day: workDay,
    start_time: formatTimeHHMM(s.start_time, '08:00'),
    end_time: formatTimeHHMM(s.end_time, '17:00'),
    shift_type: s.shift_type || 'OFFICE_HOURS',
    department: s.employees?.department?.name || '',
    note: s.note || '',
  }
}

export async function list(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = { employees: await getEmployeeScope(requesterUser) }

  if (requesterUser?.role === 'EMPLOYEE' && requesterUser.id) {
    const emp = await findEmployeeByUserId(requesterUser.id)
    if (!emp) return []
    where.employee_id = emp.id
  } else {
    const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
      ? query.employeeId
      : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

    if (empIdFilter) {
      const emp = await findEmployeeByIdOrCode(empIdFilter)
      if (emp) where.employee_id = emp.id
    }
  }

  if (typeof query.date === 'string' && query.date) {
    where.work_date = new Date(query.date)
  }

  const shifts = await prisma.employee_shifts.findMany({
    where,
    include: {
      employees: {
        include: { department: true },
      },
    },
    orderBy: { work_date: 'desc' },
  })

  return shifts.map(formatShift)
}

export async function assignOrUpdate(data: {
  employee_id: string
  date: string
  work_day?: string
  shift_type: string
  start_time?: string
  end_time?: string
  note?: string
}, actorUserId?: string, actorRole?: string) {
  const emp = await findEmployeeByIdOrCode(data.employee_id)
  if (!emp) throw new AppError(404, 'Employee not found')

  if (emp.status !== 'ACTIVE') {
    if (emp.status === 'TERMINATED') {
      throw new AppError(400, 'Không thể phân ca làm việc cho nhân viên ĐÃ NGHỈ VIỆC (TERMINATED)!')
    }
    if (emp.status === 'INACTIVE') {
      throw new AppError(400, 'Không thể phân ca làm việc cho nhân viên đang ở trạng thái TẠM NGƯNG (INACTIVE)!')
    }
    throw new AppError(400, `Không thể phân ca làm việc cho nhân viên có trạng thái '${emp.status}'!`)
  }

  const work_date = new Date(`${data.date}T00:00:00.000Z`)

  // Kiểm tra ngày đã khóa công qua attendance module API. Khi đã khóa, chỉ ADMIN mới được can thiệp
  const isLocked = await isAttendanceDateLocked(work_date)
  if (isLocked && actorRole?.toUpperCase() !== 'ADMIN') {
    throw AppError.forbidden(
      'Dữ liệu công ngày này đã bị khóa (Locked). Không thể thay đổi ca làm việc của ngày đã chốt!'
    )
  }

  const dayIndex = work_date.getUTCDay()
  const work_day = data.work_day || DAY_NAMES[dayIndex] || 'Thứ Hai'

  // Quy định: 3 ca làm việc mặc định có giờ cố định KHÔNG THỂ SỬA. Ca khác (OTHER) cho phép sửa giờ nhưng KHÔNG ĐƯỢC để 00:00 - 00:00.
  const normalizedType = (data.shift_type || 'OFFICE_HOURS').toUpperCase() as keyof typeof STANDARD_SHIFT_CONFIGS
  const standardConfig = STANDARD_SHIFT_CONFIGS[normalizedType]
  if (!standardConfig) {
    throw new AppError(
      400,
      'Loại ca không hợp lệ! Hệ thống hỗ trợ: Ca Hành Chính (OFFICE_HOURS: 08:00 - 17:00), Ca Sáng (MORNING: 08:00 - 12:00), Ca Chiều (AFTERNOON: 13:00 - 17:00), Ca khác (OTHER: tùy chỉnh giờ) hoặc Nghỉ ca'
    )
  }

  let startTimeDate: Date
  let endTimeDate: Date

  if (standardConfig.is_fixed) {
    // 3 Ca chuẩn và OFF: Ép cứng giờ theo quy định doanh nghiệp
    startTimeDate = parseTimeStringToDate(standardConfig.start_time, '08:00')
    endTimeDate = parseTimeStringToDate(standardConfig.end_time, '17:00')
  } else {
    // An earlier end clock belongs to the next day; equal clocks are ambiguous.
    const rawStart = data.start_time?.trim() || ''
    const rawEnd = data.end_time?.trim() || ''
    const clockPattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/
    if (!clockPattern.test(rawStart) || !clockPattern.test(rawEnd) || rawStart === rawEnd) {
      throw new AppError(
        400,
        'Giờ ca phải có dạng HH:mm hợp lệ và giờ bắt đầu khác giờ kết thúc; giờ kết thúc sớm hơn được tính sang ngày hôm sau.'
      )
    }
    startTimeDate = parseTimeStringToDate(rawStart, '00:00')
    endTimeDate = parseTimeStringToDate(rawEnd, '00:00')
  }

  const shiftRecord = await prisma.$transaction(async tx => {
    const prevDateStr = addDays(data.date, -1)
    const nextDateStr = addDays(data.date, 1)
    const candidateDates = [prevDateStr, data.date, nextDateStr]

    // Khóa theo thứ tự nhất quán toàn hệ thống để chống bế tắc (deadlock):
    // 1. Tất cả các kỳ lương liên quan theo thứ tự tăng dần
    // 2. Nhân viên
    // 3. Tất cả các ngày công liên quan theo thứ tự tăng dần
    const periods = Array.from(new Set(candidateDates.map(d => d.slice(0, 7)))).sort()
    if (typeof (tx as any).$executeRaw === 'function') {
      for (const p of periods) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payrollPeriodLockKey(p)}))`
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${employeeLockKey(emp.id)}))`
      const sortedDates = [...candidateDates].sort()
      for (const d of sortedDates) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`attendance:${d}`}))`
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shift-type:${standardConfig.code}`}))`
    }

    // Đọc lại trạng thái nhân viên bên trong transaction sau khi đã có lock
    const freshEmp = (await findEmployeeByIdOrCode(emp.id, tx)) ?? emp
    if (!freshEmp || freshEmp.status !== 'ACTIVE') {
      if (freshEmp?.status === 'TERMINATED') {
        throw new AppError(400, 'Không thể phân ca làm việc cho nhân viên ĐÃ NGHỈ VIỆC (TERMINATED)!')
      }
      if (freshEmp?.status === 'INACTIVE') {
        throw new AppError(400, 'Không thể phân ca làm việc cho nhân viên đang ở trạng thái TẠM NGƯNG (INACTIVE)!')
      }
      throw new AppError(400, `Không thể phân ca làm việc cho nhân viên có trạng thái '${freshEmp?.status || 'UNKNOWN'}'!`)
    }

    await assertCanManageEmployee({ id: actorUserId, role: actorRole }, emp.id, tx)

    const existingShift = await tx.employee_shifts.findFirst({
      where: {
        employee_id: emp.id,
        work_date,
      },
      include: { work_shifts: true },
    })

    const existingPrevShift = await tx.employee_shifts.findFirst({
      where: { employee_id: emp.id, work_date: new Date(`${prevDateStr}T00:00:00.000Z`) },
      include: { work_shifts: true },
    })

    const existingNextShift = await tx.employee_shifts.findFirst({
      where: { employee_id: emp.id, work_date: new Date(`${nextDateStr}T00:00:00.000Z`) },
      include: { work_shifts: true },
    })

    const isPrevOvernight = existingPrevShift
      ? (existingPrevShift.end_time ?? existingPrevShift.work_shifts?.end_time) <= (existingPrevShift.start_time ?? existingPrevShift.work_shifts?.start_time)
      : false
    const existingStartStr = existingShift ? formatTimeHHMM(existingShift.start_time ?? existingShift.work_shifts?.start_time, '08:00') : '08:00'
    const newStartStr = formatTimeHHMM(startTimeDate, '08:00')
    const isEarlyStart = standardConfig.code !== 'OFF' && (existingStartStr <= '04:00' || newStartStr <= '04:00')
    const isPrevAffected = isPrevOvernight || isEarlyStart

    const isExistingOvernight = existingShift
      ? (existingShift.end_time ?? existingShift.work_shifts?.end_time) <= (existingShift.start_time ?? existingShift.work_shifts?.start_time)
      : false
    const isNewOvernight = standardConfig.code !== 'OFF' && formatTimeHHMM(endTimeDate, '17:00') <= formatTimeHHMM(startTimeDate, '08:00')
    const isNextEarlyStart = existingNextShift
      ? formatTimeHHMM(existingNextShift.start_time ?? existingNextShift.work_shifts?.start_time, '08:00') <= '04:00'
      : false
    const isNextAffected = isExistingOvernight || isNewOvernight || isNextEarlyStart

    const affectedDates = [
      ...(isPrevAffected ? [prevDateStr] : []),
      data.date,
      ...(isNextAffected ? [nextDateStr] : []),
    ]

    // 1. Kiểm tra trạng thái khóa và kỳ lương của TẤT CẢ các ngày thực sự bị ảnh hưởng TRƯỚC KHI thực hiện bất kỳ thay đổi nào
    for (const d of affectedDates) {
      await assertEditableDay(tx, d, emp.id)
    }

    const shiftNameMatches: string[] = [standardConfig.name]
    if (standardConfig.code === 'OFFICE_HOURS') shiftNameMatches.push('Full time', 'Ca Hành Chính', 'Ca hành chính')
    else if (standardConfig.code === 'MORNING') shiftNameMatches.push('Part time: Ca sáng', 'Ca Sáng', 'Ca sáng')
    else if (standardConfig.code === 'AFTERNOON') shiftNameMatches.push('Part time: Ca chiều', 'Ca Chiều', 'Ca chiều')
    else if (standardConfig.code === 'OTHER') shiftNameMatches.push('Ca khác', 'Ca Khác', 'OTHER', 'Other')
    else if (standardConfig.code === 'OFF') shiftNameMatches.push('Nghỉ ca', 'Nghỉ (OFF)', 'OFF')

    let defaultWorkShift = await tx.work_shifts.findFirst({
      where: { shift_name: { in: shiftNameMatches } },
    })
    if (!defaultWorkShift) {
      defaultWorkShift = await tx.work_shifts.create({
        data: {
          shift_name: standardConfig.name,
          start_time: standardConfig.is_fixed ? startTimeDate : parseTimeStringToDate('00:00'),
          end_time: standardConfig.is_fixed ? endTimeDate : parseTimeStringToDate('00:00'),
        },
      })
    }

    // 2. Kiểm tra chồng lấn thời gian với ca liền kề (Issue 3)
    if (standardConfig.code !== 'OFF') {
      const newStart = new Date(`${data.date}T${formatTimeHHMM(startTimeDate, '08:00')}:00+07:00`)
      let newEnd = new Date(`${data.date}T${formatTimeHHMM(endTimeDate, '17:00')}:00+07:00`)
      if (+newEnd <= +newStart) {
        newEnd.setUTCDate(newEnd.getUTCDate() + 1)
      }

      const candidateDates = [
        new Date(`${prevDateStr}T00:00:00.000Z`),
        new Date(`${data.date}T00:00:00.000Z`),
        new Date(`${nextDateStr}T00:00:00.000Z`),
      ]

      const nearbyShifts = typeof tx.employee_shifts.findMany === 'function'
        ? await tx.employee_shifts.findMany({
            where: {
              employee_id: emp.id,
              work_date: { in: candidateDates },
              ...(existingShift ? { id: { not: existingShift.id } } : {}),
            },
            include: { work_shifts: true },
          })
        : []

      for (const adj of nearbyShifts) {
        if (adj.shift_type === 'OFF') continue
        const adjDateStr = adj.work_date.toISOString().slice(0, 10)
        const adjStartRaw = adj.start_time ?? adj.work_shifts?.start_time
        const adjEndRaw = adj.end_time ?? adj.work_shifts?.end_time
        const adjStart = new Date(`${adjDateStr}T${formatTimeHHMM(adjStartRaw, '08:00')}:00+07:00`)
        let adjEnd = new Date(`${adjDateStr}T${formatTimeHHMM(adjEndRaw, '17:00')}:00+07:00`)
        if (+adjEnd <= +adjStart) {
          adjEnd.setUTCDate(adjEnd.getUTCDate() + 1)
        }

        const overlapMs = Math.min(+newEnd, +adjEnd) - Math.max(+newStart, +adjStart)
        if (overlapMs > 0) {
          throw AppError.badRequest(
            `Ca làm việc bị chồng lấn thời gian với ca ngày ${adjDateStr} (${formatTimeHHMM(adjStartRaw, '08:00')} - ${formatTimeHHMM(adjEndRaw, '17:00')})`
          )
        }
      }
    }

    let shiftRecord
    if (existingShift) {
      shiftRecord = await tx.employee_shifts.update({
        where: { id: existingShift.id },
        data: {
          shift_id: defaultWorkShift.id,
          work_day,
          shift_type: standardConfig.code,
          start_time: startTimeDate,
          end_time: endTimeDate,
          note: data.note ?? '',
        },
        include: {
          employees: {
            include: { department: true },
          },
        },
      })
    } else {
      shiftRecord = await tx.employee_shifts.create({
        data: {
          employee_id: emp.id,
          shift_id: defaultWorkShift.id,
          work_date,
          work_day,
          shift_type: standardConfig.code,
          start_time: startTimeDate,
          end_time: endTimeDate,
          note: data.note ?? '',
        },
        include: {
          employees: {
            include: { department: true },
          },
        },
      })
    }

    await tx.auditLog.create({ data: {
      userId: actorUserId,
      action: existingShift ? 'UPDATE_SHIFT' : 'ASSIGN_SHIFT',
      target_table: 'employee_shifts',
      record_id: String(shiftRecord.id),
      old_values: existingShift
        ? {
          work_date: existingShift.work_date.toISOString(),
          shift_type: existingShift.shift_type,
          start_time: formatTimeHHMM(existingShift.start_time, '08:00'),
          end_time: formatTimeHHMM(existingShift.end_time, '17:00'),
        }
        : undefined,
      new_values: {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        work_date: work_date.toISOString(),
        shift_type: data.shift_type,
        start_time: formatTimeHHMM(startTimeDate, '08:00'),
        end_time: formatTimeHHMM(endTimeDate, '17:00'),
      },
    } })

    // 3. Invalidate và tổng hợp lại cho tất cả các ngày liền kề bị ảnh hưởng (Issue 4)
    for (const d of affectedDates) {
      const dDate = new Date(`${d}T00:00:00Z`)
      await invalidateDailySummaryForShiftChange(emp.id, dDate, tx)
      await aggregateDailyAttendance(Number(d.slice(5, 7)), Number(d.slice(0, 4)), emp.id, d, undefined, tx)
    }

    return shiftRecord
  }, { maxWait: 20000, timeout: 60000 })
  return formatShift(shiftRecord)
}

export async function assignOrUpdateWithPermissionCheck(
  data: {
    employee_id: string
    date: string
    work_day?: string
    shift_type: string
    start_time?: string
    end_time?: string
    note?: string
  },
  actorUser?: { id?: string; role?: string }
) {
  await assertCanManageEmployee(actorUser, data.employee_id)

  return assignOrUpdate(data, actorUser?.id, actorUser?.role)
}

/**
 * Public Module API: Lấy ca làm việc của 1 nhân viên trong 1 ngày cụ thể (cho Attendance module)
 */
export async function getEmployeeShiftForDate(employeeId: string, workDate: Date) {
  return prisma.employee_shifts.findFirst({
    where: {
      employee_id: employeeId,
      work_date: workDate,
    },
    include: {
      work_shifts: true,
    },
  })
}


export {
  STANDARD_SHIFT_CONFIGS,
  getDefaultShift,
  getShiftClient,
  getEmployeeShiftsByDates,
  getEmployeeShiftsByFilter,
  getEmployeeShiftsForDateRange,
  getEmployeeNearShifts,
  getEmployeeShiftsForAggregation,
  getEmployeeShiftsBeforeCutoff,
  getEmployeeShiftsForEarlySettlement,
  purgeShiftsForEarlySettlement,
  deleteShiftsForEmployee,
  getEmployeeShiftsForRecalculation,
  getActiveEmployeeShiftsWithDetails,
} from './shift.queries.js'
