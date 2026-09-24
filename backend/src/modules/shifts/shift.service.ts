import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'

const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

export function formatShift(s: any) {
  const dateStr = s.work_date instanceof Date
    ? s.work_date.toISOString().slice(0, 10)
    : String(s.work_date).slice(0, 10)

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
    start_time: s.start_time || '08:00',
    end_time: s.end_time || '17:30',
    shift_type: s.shift_type || 'OFFICE_HOURS',
    department: s.employees?.department?.name || '',
    note: s.note || '',
  }
}

export async function list(query: Record<string, unknown>) {
  const where: Record<string, unknown> = {}

  if (typeof query.employee_id === 'string' && query.employee_id) {
    const emp = await prisma.employee.findFirst({
      where: buildIdOrCodeWhere(query.employee_id),
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
}) {
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employee_id),
  })
  if (!emp) throw new AppError(404, 'Employee not found')

  if (emp.status === 'INACTIVE' || emp.status !== 'ACTIVE') {
    throw new AppError(400, 'Không thể phân ca làm việc cho nhân viên đang ở trạng thái TẠM NGƯNG!')
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

  let shiftRecord
  if (existingShift) {
    shiftRecord = await (prisma.employee_shifts as any).update({
      where: { id: existingShift.id },
      data: {
        work_day,
        shift_type: data.shift_type,
        start_time: data.start_time ?? '08:00',
        end_time: data.end_time ?? '17:30',
        note: data.note ?? '',
      } as any,
      include: {
        employees: {
          include: { department: true },
        },
      },
    })
  } else {
    shiftRecord = await (prisma.employee_shifts as any).create({
      data: {
        employee_id: emp.id,
        shift_id: defaultWorkShift.id,
        work_date,
        work_day,
        shift_type: data.shift_type,
        start_time: data.start_time ?? '08:00',
        end_time: data.end_time ?? '17:30',
        note: data.note ?? '',
      } as any,
      include: {
        employees: {
          include: { department: true },
        },
      },
    })
  }

  return formatShift(shiftRecord)
}