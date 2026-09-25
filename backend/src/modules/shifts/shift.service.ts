import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, formatVNDateISO } from '../../common/utils.js'
import { logAction } from '../audit-logs/audit.service.js'

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

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

export async function list(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {}

  const empIdFilter = (typeof query.employeeId === 'string' && query.employeeId)
    ? query.employeeId
    : (typeof query.employee_id === 'string' && query.employee_id ? query.employee_id : undefined)

  if (empIdFilter) {
    const emp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(empIdFilter),
    })
    if (emp) where.employee_id = emp.id
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
}, actorUserId?: string) {
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employee_id),
  })
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
  const dayIndex = work_date.getUTCDay()
  const work_day = data.work_day || DAY_NAMES[dayIndex] || 'Thứ Hai'

  let defaultWorkShift = await prisma.work_shifts.findFirst()
  if (!defaultWorkShift) {
    defaultWorkShift = await prisma.work_shifts.create({
      data: {
        shift_name: 'Ca Hành Chính',
        start_time: new Date('1970-01-01T08:00:00.000Z'),
        end_time: new Date('1970-01-01T17:30:00.000Z'),
      },
    })
  }

  const existingShift = await prisma.employee_shifts.findFirst({
    where: {
      employee_id: emp.id,
      work_date,
    },
  })

  const startTimeDate = parseTimeStringToDate(data.start_time, '08:00')
  const endTimeDate = parseTimeStringToDate(data.end_time, '17:30')

  let shiftRecord
  if (existingShift) {
    shiftRecord = await prisma.employee_shifts.update({
      where: { id: existingShift.id },
      data: {
        work_day,
        shift_type: data.shift_type,
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
    shiftRecord = await prisma.employee_shifts.create({
      data: {
        employee_id: emp.id,
        shift_id: defaultWorkShift.id,
        work_date,
        work_day,
        shift_type: data.shift_type,
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

  await logAction({
    userId: actorUserId,
    action: existingShift ? 'UPDATE_SHIFT' : 'ASSIGN_SHIFT',
    target_table: 'employee_shifts',
    record_id: String(shiftRecord.id),
    old_values: existingShift
      ? {
        work_date: existingShift.work_date,
        shift_type: existingShift.shift_type,
        start_time: formatTimeHHMM(existingShift.start_time, '08:00'),
        end_time: formatTimeHHMM(existingShift.end_time, '17:30'),
      }
      : undefined,
    new_values: {
      employee_id: emp.id,
      employee_code: emp.employee_code,
      work_date,
      shift_type: data.shift_type,
      start_time: formatTimeHHMM(startTimeDate, '08:00'),
      end_time: formatTimeHHMM(endTimeDate, '17:30'),
    },
  })

  return formatShift(shiftRecord)
}