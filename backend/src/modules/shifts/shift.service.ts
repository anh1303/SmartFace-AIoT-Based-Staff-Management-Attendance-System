import type { Prisma } from '@prisma/client'
import { assertEditableDay, aggregateDailyAttendance } from '../attendance/attendance.service.js'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, formatVNDateISO } from '../../common/utils.js'
import { logAction } from '../audit-logs/audit.service.js'
import { isEmployeeManager, assertCanAccessEmployeeDetail } from '../../common/permission.helper.js'
import { findEmployeeByIdOrCode, findEmployeeByUserId } from '../employees/index.js'
import { isAttendanceDateLocked } from '../attendance/attendance.lock.js'

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/**
 * 3 Ca làm việc mặc định chuẩn của toàn hệ thống.
 * Giờ bắt đầu và kết thúc là cố định và KHÔNG THỂ SỬA ĐỔI.
 */
export const STANDARD_SHIFT_CONFIGS = {
  OFFICE_HOURS: {
    code: 'OFFICE_HOURS',
    name: 'Ca Hành Chính',
    start_time: '08:00',
    end_time: '17:30',
  },
  MORNING: {
    code: 'MORNING',
    name: 'Ca Sáng',
    start_time: '08:30',
    end_time: '17:30',
  },
  AFTERNOON: {
    code: 'AFTERNOON',
    name: 'Ca Chiều',
    start_time: '13:00',
    end_time: '21:30',
  },
  OFF: {
    code: 'OFF',
    name: 'Nghỉ ca (OFF)',
    start_time: '00:00',
    end_time: '00:00',
  },
} as const

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
    end_time: formatTimeHHMM(s.end_time, '17:30'),
    shift_type: s.shift_type || 'OFFICE_HOURS',
    department: s.employees?.department?.name || '',
    note: s.note || '',
  }
}

export async function list(
  query: Record<string, unknown>,
  requesterUser?: { id?: string; role?: string }
) {
  const where: Record<string, unknown> = {}

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

  // Quy định: Hệ thống chỉ có 3 ca làm việc mặc định và giờ bắt đầu, kết thúc đều là cố định, KHÔNG THỂ SỬA
  const normalizedType = (data.shift_type || 'OFFICE_HOURS').toUpperCase() as keyof typeof STANDARD_SHIFT_CONFIGS
  const standardConfig = STANDARD_SHIFT_CONFIGS[normalizedType]
  if (!standardConfig) {
    throw new AppError(
      400,
      'Loại ca không hợp lệ! Hệ thống chỉ hỗ trợ 3 ca làm việc mặc định: Ca Hành Chính (OFFICE_HOURS: 08:00 - 17:30), Ca Sáng (MORNING: 08:30 - 17:30), Ca Chiều (AFTERNOON: 13:00 - 21:30) hoặc Nghỉ ca (OFF)'
    )
  }

  // Luôn luôn áp dụng giờ bắt đầu và kết thúc cố định theo quy định của hệ thống
  const startTimeDate = parseTimeStringToDate(standardConfig.start_time, '08:00')
  const endTimeDate = parseTimeStringToDate(standardConfig.end_time, '17:30')

  const shiftRecord = await prisma.$transaction(async tx => {
    await assertEditableDay(tx, data.date, emp.id)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shift-type:${standardConfig.code}`}))`

    const shiftNameMatches: string[] = [standardConfig.name]
    if (standardConfig.code === 'OFFICE_HOURS') shiftNameMatches.push('Full time', 'Ca Hành Chính', 'Ca hành chính')
    else if (standardConfig.code === 'MORNING') shiftNameMatches.push('Part time: Ca sáng', 'Ca Sáng', 'Ca sáng')
    else if (standardConfig.code === 'AFTERNOON') shiftNameMatches.push('Part time: Ca chiều', 'Ca Chiều', 'Ca chiều')
    else if (standardConfig.code === 'OFF') shiftNameMatches.push('Nghỉ (OFF)', 'Nghỉ ca (OFF)', 'OFF')

    let defaultWorkShift = await tx.work_shifts.findFirst({
      where: { shift_name: { in: shiftNameMatches } },
    })
    if (!defaultWorkShift) {
      defaultWorkShift = await tx.work_shifts.create({
        data: {
          shift_name: standardConfig.name,
          start_time: startTimeDate,
          end_time: endTimeDate,
        },
      })
    }

    const existingShift = await tx.employee_shifts.findFirst({
      where: {
        employee_id: emp.id,
        work_date,
      },
    })

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

    await tx.daily_attendance_summary.updateMany({ where: { employee_id: emp.id, work_date }, data: { policy_version: null, requires_review: true, review_reason: 'SHIFT_CHANGED' } })
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
          end_time: formatTimeHHMM(existingShift.end_time, '17:30'),
        }
        : undefined,
      new_values: {
        employee_id: emp.id,
        employee_code: emp.employee_code,
        work_date: work_date.toISOString(),
        shift_type: data.shift_type,
        start_time: formatTimeHHMM(startTimeDate, '08:00'),
        end_time: formatTimeHHMM(endTimeDate, '17:30'),
      },
    } })

    return shiftRecord
  })
  await aggregateDailyAttendance(Number(data.date.slice(5, 7)), Number(data.date.slice(0, 4)), emp.id, data.date)
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
  if (actorUser?.role !== 'ADMIN') {
    await assertCanAccessEmployeeDetail(actorUser, data.employee_id)
    const targetEmp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(data.employee_id),
      include: {
        department: true,
        position: true,
        users: {
          select: {
            id: true,
            roles: { select: { role_name: true } },
          },
        },
      },
    })
    if (!targetEmp) throw AppError.notFound('Không tìm thấy nhân viên')

    if (targetEmp.user_id === actorUser?.id) {
      throw AppError.forbidden(
        'Không ai được tự phân ca hoặc sửa ca làm việc của chính mình. Vui lòng liên hệ Quản trị viên (Admin) phê duyệt!'
      )
    }

    if (actorUser?.role === 'MANAGER' && isEmployeeManager(targetEmp)) {
      throw AppError.forbidden('Quản lý không có quyền phân ca cho quản lý khác!')
    }
  }

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

/**
 * Public Module API: Lấy danh sách ca làm việc theo khoảng ngày (cho Attendance batch aggregation)
 */
export async function getEmployeeShiftsForDateRange(
  dateRange: { gte: Date; lte: Date },
  employeeIds?: string[]
) {
  return prisma.employee_shifts.findMany({
    where: {
      work_date: {
        gte: dateRange.gte,
        lte: dateRange.lte,
      },
      ...(employeeIds && employeeIds.length > 0 ? { employee_id: { in: employeeIds } } : {}),
    },
    include: {
      work_shifts: true,
      employees: {
        select: { id: true, employee_code: true, full_name: true },
      },
    },
  })
}

/**
 * Public Module API: Lấy ca làm việc mặc định của hệ thống (ưu tiên 'Ca Hành Chính', fallback ca active đầu tiên)
 */
export async function getDefaultShift(tx?: Prisma.TransactionClient) {
  const client = tx ?? prisma
  const preferred = await client.work_shifts.findFirst({
    where: {
      OR: [
        { shift_name: { equals: 'Ca Hành Chính', mode: 'insensitive' } },
        { shift_name: { equals: 'Ca Hanh Chinh', mode: 'insensitive' } },
      ],
    },
  })
  if (preferred) return preferred
  return client.work_shifts.findFirst({
    orderBy: { id: 'asc' },
  })
}

/**
 * Public Module API: Lấy ca làm việc theo danh sách ngày và nhân viên (cho Attendance batch query)
 */
export async function getEmployeeShiftsByDates(
  dates: Date[],
  employeeIds: string[],
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma
  return client.employee_shifts.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: { in: dates },
    },
    select: {
      employee_id: true,
      work_date: true,
      start_time: true,
      end_time: true,
      shift_type: true,
    },
  })
}

/**
 * Public Module API: Lấy danh sách phân ca nhân viên theo bộ lọc linh hoạt (employeeIds, workDate range hoặc đơn lẻ)
 */
export async function getEmployeeShiftsByFilter(
  filter: {
    employeeIds?: string[]
    workDate?: Date | string | { gte?: Date | string; lte?: Date | string }
  },
  tx?: Prisma.TransactionClient
) {
  const client = tx ?? prisma
  return client.employee_shifts.findMany({
    where: {
      ...(filter.employeeIds?.length ? { employee_id: { in: filter.employeeIds } } : {}),
      ...(filter.workDate ? { work_date: filter.workDate as any } : {}),
    },
    include: { work_shifts: true },
  })
}