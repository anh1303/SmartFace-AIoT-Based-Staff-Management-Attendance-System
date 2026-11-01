import type { Prisma } from '@prisma/client'
import { prisma } from '../../config/database.js'

export const STANDARD_SHIFT_CONFIGS = {
  OFFICE_HOURS: {
    code: 'OFFICE_HOURS',
    name: 'Ca Hành Chính',
    start_time: '08:00',
    end_time: '17:00',
    is_fixed: true,
  },
  MORNING: {
    code: 'MORNING',
    name: 'Ca Sáng',
    start_time: '08:00',
    end_time: '12:00',
    is_fixed: true,
  },
  AFTERNOON: {
    code: 'AFTERNOON',
    name: 'Ca Chiều',
    start_time: '13:00',
    end_time: '17:00',
    is_fixed: true,
  },
  OTHER: {
    code: 'OTHER',
    name: 'Ca khác',
    start_time: '00:00',
    end_time: '00:00',
    is_fixed: false,
  },
  OFF: {
    code: 'OFF',
    name: 'Nghỉ ca',
    start_time: '00:00',
    end_time: '00:00',
    is_fixed: true,
  },
} as const

export function getShiftClient(tx?: Prisma.TransactionClient) {
  return (tx ?? prisma) as unknown as typeof prisma
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
  const client = getShiftClient(tx)
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
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: {
      ...(filter.employeeIds?.length ? { employee_id: { in: filter.employeeIds } } : {}),
      ...(filter.workDate ? { work_date: filter.workDate as any } : {}),
    },
    include: { work_shifts: true },
  })
}

/**
 * Public Module API: Lấy ca làm việc lân cận thời điểm quẹt thẻ
 */
export async function getEmployeeNearShifts(
  employeeId: string,
  eventDay: Date,
  maxPairMs: number,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: {
      employee_id: employeeId,
      work_date: {
        gte: new Date(+eventDay - maxPairMs),
        lte: new Date(+eventDay + maxPairMs),
      },
    },
    include: { work_shifts: true },
  })
}

/**
 * Public Module API: Lấy ca làm việc phục vụ tổng hợp công (Attendance Aggregation)
 */
export async function getEmployeeShiftsForAggregation(
  employeeIds: string[],
  start: Date,
  end: Date,
  maxPairMs: number,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: {
      employee_id: { in: employeeIds },
      work_date: {
        gte: new Date(+start - maxPairMs),
        lt: new Date(+end + maxPairMs),
      },
    },
    include: { work_shifts: true },
  })
}

/**
 * Public Module API: Lấy ca làm việc trước mốc quyết toán sớm (Early Settlement)
 */
export async function getEmployeeShiftsBeforeCutoff(
  employeeId: string,
  start: Date,
  cutoffDateNextDay: Date,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: {
      employee_id: employeeId,
      work_date: { gte: start, lt: cutoffDateNextDay },
    },
    include: { work_shifts: true },
  })
}

/**
 * Public Module API: Lấy toàn bộ ca làm việc phục vụ đánh giá settlement impact
 */
export async function getEmployeeShiftsForEarlySettlement(
  employeeId: string,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: { employee_id: employeeId },
    include: { work_shifts: true },
    orderBy: { work_date: 'asc' },
  })
}

/**
 * Public Module API: Xóa các ca làm việc phát sinh sau cutoffDate khi chốt quyết toán sớm
 */
export async function purgeShiftsForEarlySettlement(
  employeeId: string,
  cutoffDateNextDay: Date,
  boundsEnd: Date,
  futurePeriodStart: Date,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  const [shiftsInPeriod, futureShifts] = await Promise.all([
    client.employee_shifts.findMany({
      where: {
        employee_id: employeeId,
        work_date: { gte: cutoffDateNextDay, lt: boundsEnd },
      },
    }),
    client.employee_shifts.findMany({
      where: {
        employee_id: employeeId,
        work_date: { gte: futurePeriodStart },
      },
    }),
  ])

  await client.employee_shifts.deleteMany({
    where: {
      employee_id: employeeId,
      work_date: { gte: cutoffDateNextDay, lt: boundsEnd },
    },
  })
  await client.employee_shifts.deleteMany({
    where: {
      employee_id: employeeId,
      work_date: { gte: futurePeriodStart },
    },
  })

  return { shiftsInPeriod, futureShifts }
}

/**
 * Public Module API: Xóa toàn bộ ca của nhân viên khi xóa nhân sự
 */
export async function deleteShiftsForEmployee(
  employeeId: string,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.deleteMany({
    where: { employee_id: employeeId },
  })
}

/**
 * Public Module API: Lấy ca làm việc phục vụ tính lại (recalculation) sau khi mở khóa ngày công
 */
export async function getEmployeeShiftsForRecalculation(
  employeeId: string,
  workDate: Date,
  maxPairMs: number,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: {
      employee_id: employeeId,
      work_date: {
        gte: new Date(+workDate - maxPairMs),
        lt: new Date(+workDate + 2 * maxPairMs),
      },
    },
    include: { work_shifts: true },
  })
}

/**
 * Public Module API: Lấy ca làm việc của nhân viên ACTIVE phục vụ quét cảnh báo thiếu lượt quẹt
 */
export async function getActiveEmployeeShiftsWithDetails(
  dateFrom: Date,
  dateTo: Date,
  tx?: Prisma.TransactionClient
) {
  const client = getShiftClient(tx)
  return client.employee_shifts.findMany({
    where: {
      work_date: { gte: dateFrom, lte: dateTo },
      employees: { status: 'ACTIVE' },
    },
    include: {
      work_shifts: true,
      employees: {
        include: {
          position: true,
          department: true,
          users: { include: { roles: true } },
        },
      },
    },
  })
}

/**
 * Public Module API: Lấy ca làm việc theo khoảng ngày
 */
export async function getEmployeeShiftsForDateRange(
  arg1: { gte: Date; lte?: Date; lt?: Date } | string[],
  arg2?: string[] | Date,
  arg3?: Date | Prisma.TransactionClient,
  arg4?: Prisma.TransactionClient
) {
  let dateRange: { gte: Date; lte?: Date; lt?: Date }
  let employeeIds: string[] | undefined
  let txClient: Prisma.TransactionClient | undefined

  if (Array.isArray(arg1)) {
    employeeIds = arg1
    dateRange = { gte: arg2 as Date, lt: arg3 as Date }
    txClient = arg4
  } else {
    dateRange = arg1
    employeeIds = arg2 as string[] | undefined
    txClient = typeof arg3 === 'object' && !(arg3 instanceof Date) ? (arg3 as Prisma.TransactionClient) : undefined
  }
  const client = getShiftClient(txClient)

  if (!(client as any)?.employee_shifts?.findMany) {
    return []
  }

  return client.employee_shifts.findMany({
    where: {
      work_date: dateRange,
      ...(employeeIds && employeeIds.length > 0 ? { employee_id: { in: employeeIds } } : {}),
    },
    include: {
      work_shifts: true,
      employees: {
        select: { id: true, employee_code: true, full_name: true },
      },
    },
    orderBy: { work_date: 'asc' },
  })
}
