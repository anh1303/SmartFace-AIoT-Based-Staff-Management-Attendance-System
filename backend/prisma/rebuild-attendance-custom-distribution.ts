import { prisma } from '../src/config/database.js'
import { aggregateDailyAttendance, createAttendanceSnapshot } from '../src/modules/attendance/attendance.service.js'
import { generate, finalizePeriod } from '../src/modules/payroll/payroll.service.js'
import { vnDay, shiftBounds } from '../src/modules/attendance/attendance.policy.js'
import { syncDayAdjustments } from '../src/modules/attendance/attendance.adjustments.js'
import { sourceHourlyRate } from '../src/modules/employees/employee.wage.js'
import { policyForPeriod } from '../src/common/payroll-policy.js'
import { Prisma } from '@prisma/client'

/**
 * Tạo timestamp Date chính xác theo múi giờ Việt Nam (+07:00)
 */
function makeVNTimestamp(dateStr: string, totalMinutes: number, seconds: number = 0): Date {
  const normalizedSeconds = Math.max(0, totalMinutes * 60 + seconds)
  const h = Math.floor(normalizedSeconds / 3600)
  const rem = normalizedSeconds % 3600
  const m = Math.floor(rem / 60)
  const s = rem % 60

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoVN = `${dateStr}T${pad(h)}:${pad(m)}:${pad(s)}+07:00`
  return new Date(isoVN)
}

/**
 * Thuật toán sinh số giả ngẫu nhiên có seed (Mulberry32)
 */
function seededRandom(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function main() {
  console.log('================================================================')
  console.log('   TÁI THIẾT DỮ LIỆU CHẤM CÔNG VÀ ĐỒNG BỘ BẢNG LƯƠNG (CLOUD DB)')
  console.log('================================================================')

  // ---------------------------------------------------------
  // BƯỚC 1: KIỂM TRA DỮ LIỆU NỀN
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 1: KIỂM TRA DỮ LIỆU NỀN ---')
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employee_code: true,
      full_name: true,
      createdAt: true,
      status: true,
      hourly_rate: true,
      departmentId: true,
      positionId: true,
      user_id: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Tìm thấy ${employees.length} nhân viên trong hệ thống.`)

  const adminUser = await prisma.user.findFirst({
    where: { roles: { role_name: 'ADMIN' }, is_active: true },
    select: { id: true, username: true },
  })
  if (!adminUser) {
    throw new Error('Không tìm thấy tài khoản ADMIN trong hệ thống để thực thi.')
  }
  console.log(`Người thực hiện (ADMIN): ${adminUser.username} (${adminUser.id})`)

  // Kiểm tra phân ca hiện có
  const existingShifts = await prisma.employee_shifts.findMany({
    include: { work_shifts: true },
    orderBy: [{ work_date: 'asc' }, { employee_id: 'asc' }],
  })
  console.log(`Tìm thấy ${existingShifts.length} phân ca (employee_shifts) hiện có trong DB.`)

  const offShifts = existingShifts.filter((s) => s.shift_type === 'OFF')
  const workShifts = existingShifts.filter((s) => s.shift_type !== 'OFF')
  console.log(`Trong đó: ${offShifts.length} ca nghỉ (OFF) và ${workShifts.length} ca làm việc thực tế.`)

  if (workShifts.length === 0) {
    throw new Error('Không có ca làm việc nào trong database! Vui lòng kiểm tra lại phân ca.')
  }

  // Đảm bảo chính sách lương nền 2026-08 tồn tại
  const basePolicy = await prisma.bonusPenalty.findFirst({
    where: { OR: [{ effective_period: null }, { effective_period: '2026-08' }] },
  })
  if (basePolicy) {
    if (basePolicy.effective_period !== '2026-08') {
      await prisma.bonusPenalty.update({
        where: { id: basePolicy.id },
        data: { effective_period: '2026-08' },
      })
    }
  } else {
    await prisma.bonusPenalty.create({
      data: {
        effective_period: '2026-08',
        overtime_rate: 2.0,
        late_early_penalty: 1.5,
        absence_penalty_rate: 2.0,
        description: 'Chính sách hệ số lương áp dụng từ tháng 08/2026',
      },
    })
  }

  // ---------------------------------------------------------
  // BƯỚC 2: XÓA DỮ LIỆU CHẤM CÔNG CŨ TRÊN CLOUD DB
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 2: XÓA DỮ LIỆU CHẤM CÔNG & LƯƠNG CŨ ---')
  const delAdj = await prisma.attendanceAdjustment.deleteMany()
  console.log(`- Đã xóa ${delAdj.count} khoản điều chỉnh (attendance_adjustments).`)

  const delPayroll = await prisma.payrollRecord.deleteMany()
  console.log(`- Đã xóa ${delPayroll.count} phiếu lương (payroll_records).`)

  const delLogs = await prisma.attendance_logs.deleteMany()
  console.log(`- Đã xóa ${delLogs.count} lượt quét (attendance_logs).`)

  const delSummaries = await prisma.daily_attendance_summary.deleteMany()
  console.log(`- Đã xóa ${delSummaries.count} tổng hợp ngày công (daily_attendance_summary).`)

  const delLocks = await prisma.attendance_locks.deleteMany()
  console.log(`- Đã xóa ${delLocks.count} khóa ngày công (attendance_locks).`)

  const delStates = await prisma.attendanceAggregationState.deleteMany()
  console.log(`- Đã xóa ${delStates.count} trạng thái tổng hợp (attendance_aggregation_state).`)

  const delNotifs = await prisma.systemNotification.deleteMany({
    where: {
      OR: [
        { event_key: { startsWith: 'missing-shift:' } },
        { event_key: { startsWith: 'aggregation-failed:' } },
        { event_key: { startsWith: 'locked-scan:' } },
        { event_key: { startsWith: 'auto-absent:' } },
      ],
    },
  })
  console.log(`- Đã xóa ${delNotifs.count} thông báo chấm công cũ.`)

  await prisma.attendanceAlertCheckpoint.upsert({
    where: { name: 'missing_shift_scans' },
    update: { last_due_at: new Date('2026-08-01T00:00:00Z') },
    create: { name: 'missing_shift_scans', last_due_at: new Date('2026-08-01T00:00:00Z') },
  })

  // ---------------------------------------------------------
  // BƯỚC 3: PHÂN BỔ TỈ LỆ VÀ SINH LƯỢT QUÉT CHẤM CÔNG (LOGS)
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 3: PHÂN BỔ TỈ LỆ & TẠO LƯỢT QUÉT (LOGS) ---')
  console.log('Mục tiêu phân bổ trên tổng ca làm việc:')
  console.log('   - 60% Đúng giờ')
  console.log('   - 10% Tăng ca - OT (50% trên 30 phút, 50% trên 1 tiếng)')
  console.log('   - 10% Nghỉ làm (ABSENT)')
  console.log('   - 10% Đi trễ (50% trên 30 phút, 50% trên 1 tiếng)')
  console.log('   - 10% Các trường hợp kiểm thử đặc thù')

  // Phân biệt ca đêm đặc thù (nếu có)
  const regularWorkShifts = workShifts.filter((s) => s.shift_type !== 'NIGHT_SHIFT')
  const nightShifts = workShifts.filter((s) => s.shift_type === 'NIGHT_SHIFT')

  const totalRegular = regularWorkShifts.length // 1194
  // Tính số lượng ca chính xác cho từng mục:
  const countOnTime = Math.round(workShifts.length * 0.6) // 717
  const countOT_30m = Math.round(workShifts.length * 0.05) // 60
  const countOT_1h = Math.round(workShifts.length * 0.05) // 60
  const countAbsent = Math.round(workShifts.length * 0.1) // 120
  const countLate_30m = Math.round(workShifts.length * 0.05) // 60
  const countLate_1h = Math.round(workShifts.length * 0.05) // 60
  // Số lượng ca kiểm thử đặc thù (trừ ca đêm đã tách)
  const countEdgeCases = totalRegular - (countOnTime + countOT_30m + countOT_1h + countAbsent + countLate_30m + countLate_1h) // 117

  console.log(`\nPhân bổ số lượng ca cụ thể (${workShifts.length} ca làm việc):`)
  console.log(`   - Đúng giờ:          ${countOnTime} ca (${((countOnTime / workShifts.length) * 100).toFixed(1)}%)`)
  console.log(`   - OT > 30p:          ${countOT_30m} ca (${((countOT_30m / workShifts.length) * 100).toFixed(1)}%)`)
  console.log(`   - OT > 1h:           ${countOT_1h} ca (${((countOT_1h / workShifts.length) * 100).toFixed(1)}%)`)
  console.log(`   - Nghỉ làm:          ${countAbsent} ca (${((countAbsent / workShifts.length) * 100).toFixed(1)}%)`)
  console.log(`   - Đi trễ > 30p:      ${countLate_30m} ca (${((countLate_30m / workShifts.length) * 100).toFixed(1)}%)`)
  console.log(`   - Đi trễ > 1h:       ${countLate_1h} ca (${((countLate_1h / workShifts.length) * 100).toFixed(1)}%)`)
  console.log(`   - Kiểm thử đặc thù:  ${countEdgeCases + nightShifts.length} ca (${(((countEdgeCases + nightShifts.length) / workShifts.length) * 100).toFixed(1)}%)`)

  // Xây dựng pool phân loại cho các ca thường
  type Category =
    | 'ON_TIME'
    | 'OT_30M'
    | 'OT_1H'
    | 'ABSENT'
    | 'LATE_30M'
    | 'LATE_1H'
    | 'EDGE_MISSING_OUT'
    | 'EDGE_MISSING_IN'
    | 'EDGE_EARLY_LEAVE'
    | 'EDGE_LATE_AND_EARLY'
    | 'EDGE_UNDER_MIN'
    | 'EDGE_OT_OVER_4H'
    | 'EDGE_DUPLICATE'

  const categoriesPool: Category[] = [
    ...Array(countOnTime).fill('ON_TIME'),
    ...Array(countOT_30m).fill('OT_30M'),
    ...Array(countOT_1h).fill('OT_1H'),
    ...Array(countAbsent).fill('ABSENT'),
    ...Array(countLate_30m).fill('LATE_30M'),
    ...Array(countLate_1h).fill('LATE_1H'),
    ...Array(20).fill('EDGE_MISSING_OUT'),
    ...Array(18).fill('EDGE_MISSING_IN'),
    ...Array(20).fill('EDGE_EARLY_LEAVE'),
    ...Array(20).fill('EDGE_LATE_AND_EARLY'),
    ...Array(15).fill('EDGE_UNDER_MIN'),
    ...Array(14).fill('EDGE_OT_OVER_4H'),
    ...Array(10).fill('EDGE_DUPLICATE'),
  ]

  // Trộn đều ngẫu nhiên có seed để phân bổ tự nhiên qua các ngày và nhân viên
  const rng = seededRandom(20261101)
  for (let i = categoriesPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const temp = categoriesPool[i]
    categoriesPool[i] = categoriesPool[j]
    categoriesPool[j] = temp
  }

  const logs: Prisma.attendance_logsCreateManyInput[] = []
  const deviceName = 'device:GATE-01'

  // Xử lý ca đêm đặc thù (nếu có)
  for (const ns of nightShifts) {
    const emp = employees.find((e) => e.id === ns.employee_id)!
    const dateStr = ns.work_date.toISOString().slice(0, 10)
    // 22:00 VN ngày 20/10 -> 15:00 UTC; check in 21:55 VN -> 14:55 UTC
    const inTime = new Date('2026-10-20T14:55:00.000Z')
    // 02:00 VN ngày 21/10 -> 19:00 UTC; check out 02:05 VN -> 19:05 UTC
    const outTime = new Date('2026-10-20T19:05:00.000Z')

    logs.push({
      employee_id: emp.id,
      event_time: inTime,
      type: 'CHECK_IN',
      method: 'FACE',
      status: 'VALID',
      device_info: deviceName,
      work_date: new Date(`${dateStr}T00:00:00Z`),
      event_key: `seed:${emp.employee_code}:${dateStr}:in`,
      verification_score: 0.94,
      liveness_score: 0.98,
    })
    logs.push({
      employee_id: emp.id,
      event_time: outTime,
      type: 'CHECK_OUT',
      method: 'FACE',
      status: 'VALID',
      device_info: deviceName,
      work_date: new Date(`${dateStr}T00:00:00Z`),
      event_key: `seed:${emp.employee_code}:${dateStr}:out`,
      verification_score: 0.93,
      liveness_score: 0.97,
    })
  }

  // Xử lý các ca làm việc hành chính
  for (let idx = 0; idx < regularWorkShifts.length; idx++) {
    const s = regularWorkShifts[idx]
    const emp = employees.find((e) => e.id === s.employee_id)!
    const dateStr = s.work_date.toISOString().slice(0, 10)
    const category = categoriesPool[idx]

    const shiftStartMins = 8 * 60 // 08:00
    const shiftEndMins = 17 * 60 // 17:00
    const r = seededRandom(idx * 7919 + 17)

    switch (category) {
      case 'ON_TIME': {
        // Vào sớm 2 - 12 phút (07:48 - 07:58)
        const earlyDelta = 2 + Math.floor(r() * 11)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins - earlyDelta, Math.floor(r() * 60))
        // Ra đúng giờ hoặc nán lại 2 - 14 phút (17:02 - 17:14) -> không tính OT vì < 30p
        const stayDelta = 2 + Math.floor(r() * 13)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + stayDelta, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.94,
          liveness_score: 0.98,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.95,
          liveness_score: 0.97,
        })
        break
      }

      case 'OT_30M': {
        // Vào đúng giờ (07:50 - 07:58)
        const earlyDelta = 2 + Math.floor(r() * 9)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins - earlyDelta, Math.floor(r() * 60))
        // Tăng ca 35 - 55 phút (17:35 - 17:55) -> OT candidate 0.5h
        const otDelta = 35 + Math.floor(r() * 21)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + otDelta, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.95,
          liveness_score: 0.98,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.94,
          liveness_score: 0.97,
        })
        break
      }

      case 'OT_1H': {
        // Vào đúng giờ (07:50 - 07:58)
        const earlyDelta = 2 + Math.floor(r() * 9)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins - earlyDelta, Math.floor(r() * 60))
        // Tăng ca trên 1 tiếng: 75 - 180 phút (18:15 - 20:00) -> OT candidate 1.5h - 3.0h
        const otDelta = 75 + Math.floor(r() * 106)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + otDelta, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.96,
          liveness_score: 0.98,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.93,
          liveness_score: 0.96,
        })
        break
      }

      case 'ABSENT': {
        // Nghỉ làm: không tạo bất kỳ log nào
        break
      }

      case 'LATE_30M': {
        // Đi trễ 31 - 55 phút (08:31 - 08:55)
        const lateDelta = 31 + Math.floor(r() * 25)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins + lateDelta, Math.floor(r() * 60))
        // Ra đúng giờ (17:02 - 17:10)
        const stayDelta = 2 + Math.floor(r() * 9)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + stayDelta, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.92,
          liveness_score: 0.95,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.94,
          liveness_score: 0.97,
        })
        break
      }

      case 'LATE_1H': {
        // Đi trễ trên 1 tiếng: 65 - 120 phút (09:05 - 10:00)
        const lateDelta = 65 + Math.floor(r() * 56)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins + lateDelta, Math.floor(r() * 60))
        // Ra đúng giờ (17:02 - 17:10)
        const stayDelta = 2 + Math.floor(r() * 9)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + stayDelta, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.91,
          liveness_score: 0.96,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.93,
          liveness_score: 0.97,
        })
        break
      }

      case 'EDGE_MISSING_OUT': {
        // Quên check-out (chỉ check-in 07:52 - 07:58)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins - (2 + Math.floor(r() * 7)), Math.floor(r() * 60))
        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.94,
          liveness_score: 0.97,
        })
        break
      }

      case 'EDGE_MISSING_IN': {
        // Quên check-in (chỉ check-out 17:03 - 17:12)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + (3 + Math.floor(r() * 10)), Math.floor(r() * 60))
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.93,
          liveness_score: 0.96,
        })
        break
      }

      case 'EDGE_EARLY_LEAVE': {
        // Về sớm: Vào 07:55, Ra lúc 15:30 - 16:15 (về sớm 45 - 90 phút)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins - 5, Math.floor(r() * 60))
        const earlyMinutes = 45 + Math.floor(r() * 46)
        const outTime = makeVNTimestamp(dateStr, shiftEndMins - earlyMinutes, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.93,
          liveness_score: 0.97,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.95,
          liveness_score: 0.98,
        })
        break
      }

      case 'EDGE_LATE_AND_EARLY': {
        // Vừa trễ vừa sớm: Vào 08:35 (trễ 35p), Ra 16:15 (sớm 45p)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins + 35, Math.floor(r() * 60))
        const outTime = makeVNTimestamp(dateStr, shiftEndMins - 45, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.92,
          liveness_score: 0.96,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.94,
          liveness_score: 0.97,
        })
        break
      }

      case 'EDGE_UNDER_MIN': {
        // Làm dưới 2/3 ca: Vào 08:00, Ra 11:30 (chỉ làm 3.5h / 9h)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins, Math.floor(r() * 60))
        const outTime = makeVNTimestamp(dateStr, shiftStartMins + 210, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.94,
          liveness_score: 0.97,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.93,
          liveness_score: 0.96,
        })
        break
      }

      case 'EDGE_OT_OVER_4H': {
        // OT vượt 4h: Vào 07:55, Ra 21:45 (OT 4h45p > 4h threshold)
        const inTime = makeVNTimestamp(dateStr, shiftStartMins - 5, Math.floor(r() * 60))
        const outTime = makeVNTimestamp(dateStr, shiftEndMins + 285, Math.floor(r() * 60))

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.95,
          liveness_score: 0.98,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.94,
          liveness_score: 0.97,
        })
        break
      }

      case 'EDGE_DUPLICATE': {
        // Quẹt thẻ trùng lặp liên tiếp: 2 lần check-in, 2 lần check-out
        const inTime1 = makeVNTimestamp(dateStr, shiftStartMins - 6, 10)
        const inTime2 = makeVNTimestamp(dateStr, shiftStartMins - 4, 30)
        const outTime1 = makeVNTimestamp(dateStr, shiftEndMins + 4, 15)
        const outTime2 = makeVNTimestamp(dateStr, shiftEndMins + 6, 45)

        logs.push({
          employee_id: emp.id,
          event_time: inTime1,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in:1`,
          verification_score: 0.95,
          liveness_score: 0.98,
        })
        logs.push({
          employee_id: emp.id,
          event_time: inTime2,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in:2`,
          verification_score: 0.94,
          liveness_score: 0.98,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime1,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out:1`,
          verification_score: 0.95,
          liveness_score: 0.97,
        })
        logs.push({
          employee_id: emp.id,
          event_time: outTime2,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: deviceName,
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out:2`,
          verification_score: 0.93,
          liveness_score: 0.97,
        })
        break
      }
    }
  }

  // Chèn logs theo batch
  const CHUNK_SIZE = 500
  for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
    await prisma.attendance_logs.createMany({
      data: logs.slice(i, i + CHUNK_SIZE),
    })
  }
  console.log(`Đã tạo thành công ${logs.length} lượt quét (attendance_logs).`)

  // ---------------------------------------------------------
  // BƯỚC 4: TỔNG HỢP CÔNG (AGGREGATE DAILY ATTENDANCE)
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 4: TỔNG HỢP NGÀY CÔNG (AGGREGATION) ---')
  console.log('- Đang tổng hợp chấm công tháng 08/2026...')
  await aggregateDailyAttendance(8, 2026)

  console.log('- Đang tổng hợp chấm công tháng 09/2026...')
  await aggregateDailyAttendance(9, 2026)

  console.log('- Đang tổng hợp chấm công tháng 10/2026...')
  await aggregateDailyAttendance(10, 2026)

  // ---------------------------------------------------------
  // BƯỚC 5: CHỐT DUYỆT CÔNG QUÁ KHỨ (T8, T9 VÀ T10 HỢP LỆ)
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 5: CHỐT DUYỆT CÔNG & KHÓA KỲ ---')
  const adjustmentPolicyT8 = await policyForPeriod('2026-08')
  const adjustmentPolicyT10 = await policyForPeriod('2026-10')

  // 5.1. Xử lý Tháng 08 và Tháng 09: Chốt APPROVED toàn bộ để có thể finalize lương
  const pastSummariesT8T9 = await prisma.daily_attendance_summary.findMany({
    where: { work_date: { lt: new Date('2026-10-01T00:00:00Z') } },
    include: { employees: true },
  })

  async function runInChunks<T>(items: T[], chunkSize: number, fn: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize)
      await Promise.all(chunk.map(fn))
    }
  }

  let t8t9AbsentConverted = 0
  await runInChunks(pastSummariesT8T9, 25, async (sum) => {
    const dateStr = sum.work_date.toISOString().slice(0, 10)
    const period = dateStr.slice(0, 7)
    const policy = period === '2026-10' ? adjustmentPolicyT10 : adjustmentPolicyT8
    const rate = sourceHourlyRate(sum.employees, period, null, false)
    const details = (sum.calculation_details || {}) as Record<string, any>
    const snapshot = createAttendanceSnapshot(sum)
    const otCandidate = Number(sum.overtime_candidate_hours ?? 0)

    const isIncomplete =
      sum.requires_review ||
      sum.attendance_status === 'INCOMPLETE' ||
      (!sum.last_check_out && sum.attendance_status !== 'OFF' && sum.attendance_status !== 'ABSENT')

    if (isIncomplete) {
      const updated = await prisma.daily_attendance_summary.update({
        where: { id: sum.id },
        data: {
          attendance_status: 'ABSENT',
          total_working_hours: 0,
          overtime: 0,
          overtime_candidate_hours: 0,
          overtime_status: 'NONE',
          late_early: 0,
          regular_seconds: 0,
          overtime_seconds: 0,
          late_early_seconds: 0,
          review_status: 'APPROVED',
          approval_source: 'SEED',
          approved_at: new Date(),
          approved_by: adminUser.id,
          approval_reason: 'Chốt tự động: ca thiếu lượt sau thời hạn OT',
          pre_approval_snapshot: snapshot,
          requires_review: false,
          calculation_details: { ...details, absenceCandidate: true },
        },
      })
      await syncDayAdjustments(prisma, updated, rate, policy?.absence_penalty_rate ?? null)
      t8t9AbsentConverted++
    } else {
      const updated = await prisma.daily_attendance_summary.update({
        where: { id: sum.id },
        data: {
          review_status: 'APPROVED',
          approval_source: 'SEED',
          approved_at: new Date(),
          approved_by: adminUser.id,
          approval_reason: 'Chốt chuẩn dữ liệu hệ thống',
          overtime: otCandidate,
          overtime_status: otCandidate > 0 ? 'APPROVED' : 'NONE',
          requires_review: false,
          pre_approval_snapshot: snapshot,
        },
      })
      await syncDayAdjustments(prisma, updated, rate, policy?.absence_penalty_rate ?? null)
    }
  })

  // Khóa tất cả các ngày công trong tháng 08 và 09
  const uniqueDatesT8T9 = [...new Set(pastSummariesT8T9.map((s) => s.work_date.toISOString().slice(0, 10)))]
  await prisma.attendance_locks.createMany({
    data: uniqueDatesT8T9.map((dStr) => ({
      work_date: new Date(`${dStr}T00:00:00Z`),
      is_locked: true,
      locked_by: 'SEED',
      locked_at: new Date(),
    })),
    skipDuplicates: true,
  })

  // Đảm bảo các adjustments của T8, T9 đều APPROVED
  await prisma.$executeRaw`
    UPDATE attendance_adjustments
    SET status = 'APPROVED',
        reviewed_by = ${adminUser.id}::uuid,
        reviewed_at = clock_timestamp()
    WHERE work_date < '2026-10-01'::date
      AND (hours > 0 OR amount > 0)
  `
  console.log(`- Đã chốt duyệt ${pastSummariesT8T9.length} ngày công và khóa ${uniqueDatesT8T9.length} ngày cho T8 & T9.`)

  // 5.2. Xử lý Tháng 10: Chốt duyệt các ngày bình thường, giữ lại các ca edge cases để người dùng kiểm thử quy trình duyệt
  const summariesT10 = await prisma.daily_attendance_summary.findMany({
    where: {
      work_date: {
        gte: new Date('2026-10-01T00:00:00Z'),
        lt: new Date('2026-11-01T00:00:00Z'),
      },
    },
    include: { employees: true },
  })

  let t10ApprovedCount = 0
  let t10PendingReviewCount = 0

  await runInChunks(summariesT10, 25, async (sum) => {
    const rate = sourceHourlyRate(sum.employees, '2026-10', null, false)
    const snapshot = createAttendanceSnapshot(sum)
    const otCandidate = Number(sum.overtime_candidate_hours ?? 0)

    // Nếu ca có cờ review (edge case) thì giữ trạng thái PENDING để kiểm thử UI duyệt công!
    if (sum.requires_review) {
      t10PendingReviewCount++
      // Vẫn đồng bộ adjustments để có khoản phạt/thưởng dự kiến hiển thị trên giao diện
      await syncDayAdjustments(prisma, sum, rate, adjustmentPolicyT10?.absence_penalty_rate ?? null)
    } else {
      // Các ca hợp lệ bình thường: chốt APPROVED
      const updated = await prisma.daily_attendance_summary.update({
        where: { id: sum.id },
        data: {
          review_status: 'APPROVED',
          approval_source: 'SEED',
          approved_at: new Date(),
          approved_by: adminUser.id,
          approval_reason: 'Chốt chuẩn dữ liệu hệ thống T10',
          overtime: otCandidate,
          overtime_status: otCandidate > 0 ? 'APPROVED' : 'NONE',
          requires_review: false,
          pre_approval_snapshot: snapshot,
        },
      })
      await syncDayAdjustments(prisma, updated, rate, adjustmentPolicyT10?.absence_penalty_rate ?? null)
      t10ApprovedCount++
    }
  })

  // Khóa các ngày đã hoàn toàn APPROVED trong tháng 10
  console.log(`- Tháng 10/2026: Đã chốt ${t10ApprovedCount} ngày hợp lệ; giữ ${t10PendingReviewCount} ca đặc thù PENDING để kiểm thử.`)

  // ---------------------------------------------------------
  // BƯỚC 6: TÍNH TOÁN VÀ ĐỒNG BỘ BẢNG LƯƠNG
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 6: ĐỒNG BỘ BẢNG LƯƠNG (PAYROLL) ---')

  // Tháng 08/2026: Tính và chốt FINALIZED
  console.log('- Đang tính lương tháng 08/2026...')
  const prT8 = await generate('2026-08', undefined, adminUser.id, { id: adminUser.id, role: 'ADMIN' })
  console.log(`  Đã tạo ${prT8.length} phiếu lương cho tháng 08/2026.`)
  console.log('- Đang chốt FINALIZED kỳ lương tháng 08/2026...')
  await finalizePeriod('2026-08', adminUser.id, 'ADMIN')
  console.log('  Kỳ lương tháng 08/2026 đã chốt FINALIZED thành công.')

  // Tháng 09/2026: Tính và chốt FINALIZED
  console.log('- Đang tính lương tháng 09/2026...')
  const prT9 = await generate('2026-09', undefined, adminUser.id, { id: adminUser.id, role: 'ADMIN' })
  console.log(`  Đã tạo ${prT9.length} phiếu lương cho tháng 09/2026.`)
  console.log('- Đang chốt FINALIZED kỳ lương tháng 09/2026...')
  await finalizePeriod('2026-09', adminUser.id, 'ADMIN')
  console.log('  Kỳ lương tháng 09/2026 đã chốt FINALIZED thành công.')

  // Tháng 10/2026: Tính và giữ PENDING
  console.log('- Đang tính lương tháng 10/2026...')
  const prT10 = await generate('2026-10', undefined, adminUser.id, { id: adminUser.id, role: 'ADMIN' })
  console.log(`  Đã tạo ${prT10.length} phiếu lương cho tháng 10/2026 (trạng thái PENDING, sẵn sàng kiểm thử thao tác chốt).`)

  // ---------------------------------------------------------
  // BƯỚC 7: BÁO CÁO THỐNG KÊ CHI TIẾT
  // ---------------------------------------------------------
  console.log('\n================================================================')
  console.log('               KẾT QUẢ THỰC HIỆN TÁI THIẾT DỮ LIỆU')
  console.log('================================================================')

  const totalEmployees = await prisma.employee.count()
  const totalShifts = await prisma.employee_shifts.count()
  const totalLogs = await prisma.attendance_logs.count()
  const totalSummaries = await prisma.daily_attendance_summary.count()

  const statPresent = await prisma.daily_attendance_summary.count({ where: { attendance_status: 'PRESENT' } })
  const statAbsent = await prisma.daily_attendance_summary.count({ where: { attendance_status: 'ABSENT' } })
  const statLate = await prisma.daily_attendance_summary.count({
    where: { attendance_status: { in: ['LATE', 'LATE_AND_EARLY'] } },
  })
  const statEarly = await prisma.daily_attendance_summary.count({ where: { attendance_status: 'EARLY_LEAVE' } })
  const statIncomplete = await prisma.daily_attendance_summary.count({ where: { attendance_status: 'INCOMPLETE' } })
  const statOff = await prisma.daily_attendance_summary.count({ where: { attendance_status: 'OFF' } })

  const statOTCandidates = await prisma.daily_attendance_summary.count({
    where: { overtime_candidate_hours: { gt: 0 } },
  })
  const statLateEarlyHours = await prisma.daily_attendance_summary.count({
    where: { late_early: { gt: 0 } },
  })

  console.log(`1. Nhân viên & Phân ca:`)
  console.log(`   - Tổng số nhân viên:                  ${totalEmployees}`)
  console.log(`   - Tổng số phân ca (giữ nguyên):       ${totalShifts} (1.195 ca làm việc, 495 ca OFF)`)
  console.log(`   - Tổng lượt quét (attendance_logs):   ${totalLogs}`)
  console.log(`   - Tổng ngày công (summaries):         ${totalSummaries}`)

  console.log(`\n2. Phân bổ trạng thái công:`)
  console.log(`   - PRESENT (Đúng giờ & OT):            ${statPresent} ca`)
  console.log(`   - ABSENT (Nghỉ làm & thiếu lượt T8/9): ${statAbsent} ca`)
  console.log(`   - LATE & LATE_AND_EARLY (Đi trễ):     ${statLate} ca`)
  console.log(`   - EARLY_LEAVE (Về sớm):               ${statEarly} ca`)
  console.log(`   - INCOMPLETE (Ca thiếu lượt/dưới min):${statIncomplete} ca`)
  console.log(`   - OFF (Ca nghỉ cuối tuần):            ${statOff} ca`)

  console.log(`\n3. Thống kê OT & Trễ sớm:`)
  console.log(`   - Số ca có tích lũy OT (> 30p & > 1h): ${statOTCandidates} ca`)
  console.log(`   - Số ca có phạt trễ/sớm:              ${statLateEarlyHours} ca`)

  const payrollT8 = await prisma.payrollRecord.findMany({ where: { payroll_period: '2026-08' } })
  const payrollT9 = await prisma.payrollRecord.findMany({ where: { payroll_period: '2026-09' } })
  const payrollT10 = await prisma.payrollRecord.findMany({ where: { payroll_period: '2026-10' } })

  console.log(`\n4. Bảng lương (payroll_records):`)
  console.log(`   - Tháng 08/2026: ${payrollT8.length} phiếu - Trạng thái: ${payrollT8[0]?.status || 'N/A'}`)
  console.log(`   - Tháng 09/2026: ${payrollT9.length} phiếu - Trạng thái: ${payrollT9[0]?.status || 'N/A'}`)
  console.log(`   - Tháng 10/2026: ${payrollT10.length} phiếu - Trạng thái: ${payrollT10[0]?.status || 'N/A'}`)
  console.log('================================================================')
}

main()
  .catch((err) => {
    console.error('LỖI TRONG QUÁ TRÌNH TÁI THIẾT DỮ LIỆU:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
