import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere } from '../../common/utils.js'

export function formatShift(s: any) {
  const dateStr = s.effective_from instanceof Date 
    ? s.effective_from.toISOString().slice(0, 10) 
    : String(s.effective_from).slice(0, 10)

  return {
    shift_id: s.id.toString(),
    employee_id: s.employees?.employee_code || s.employee_id,
    date: dateStr,
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
    where.effective_from = new Date(query.date)
  }

  const shifts = await prisma.employee_shifts.findMany({
    where,
    include: {
      employees: {
        include: { department: true },
      },
    },
    orderBy: { effective_from: 'desc' },
  })

  return shifts.map(formatShift)
}

export async function assignOrUpdate(data: {
  employee_id: string
  date: string
  shift_type: string
  start_time?: string
  end_time?: string
  note?: string
}) {
  const emp = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(data.employee_id),
  })
  if (!emp) throw new AppError(404, 'Employee not found')

  const effective_from = new Date(`${data.date}T00:00:00.000Z`)

  let defaultWorkShift = await prisma.work_shifts.findFirst()
  if (!defaultWorkShift) {
    defaultWorkShift = await prisma.work_shifts.create({
      data: {
        shift_name: 'Ca Hành Chính',
        start_time: new Date('1970-01-01T08:00:00.000Z'),
        end_time: new Date('1970-01-01T17:30:00.000Z'),
        grace_period_minutes: 15,
      },
    })
  }

  const existingShift = await prisma.employee_shifts.findFirst({
    where: {
      employee_id: emp.id,
      effective_from,
    },
  })

  let shiftRecord
  if (existingShift) {
    shiftRecord = await (prisma.employee_shifts as any).update({
      where: { id: existingShift.id },
      data: {
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
        effective_from,
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
