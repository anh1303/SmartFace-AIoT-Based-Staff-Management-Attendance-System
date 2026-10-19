import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Lấy ngày hôm nay theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) định dạng YYYY-MM-DD
 */
function getTodayVN(): string {
  const now = new Date()
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/**
 * Phân giải tham số ngày đầu vào thành danh sách các ngày YYYY-MM-DD
 * Hỗ trợ:
 * - Cả tháng: "2026-09" hoặc "2026-10" (định dạng YYYY-MM)
 * - 1 ngày:   "2026-10-16" (định dạng YYYY-MM-DD)
 */
function resolveTargetDates(input: string): string[] {
  // 1. Cả tháng YYYY-MM (ví dụ 2026-09, 2026-10)
  if (/^\d{4}-\d{2}$/.test(input)) {
    const [yearStr, monthStr] = input.split('-')
    const year = parseInt(yearStr, 10)
    const month = parseInt(monthStr, 10)
    const daysInMonth = new Date(year, month, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return `${yearStr}-${monthStr}-${day}`
    })
  }

  // 2. Ngày đơn lẻ YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    return [input]
  }

  throw new Error(
    `❌ Tham số ngày không hợp lệ: "${input}".\n` +
      `Các định dạng được hỗ trợ:\n` +
      `  - Cả tháng: 2026-09 hoặc 2026-10 (định dạng YYYY-MM)\n` +
      `  - 1 ngày:   2026-10-16 (định dạng YYYY-MM-DD)\n`
  )
}

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
 * Định dạng Date ra chuỗi giờ:phút HH:mm theo giờ VN
 */
function formatTimeVN(date: Date | null): string {
  if (!date) return '--:--'
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/**
 * Rút trích giờ và phút từ trường Time của Prisma (@db.Time(6))
 */
function extractHourMinute(
  timeVal: Date | string | null | undefined,
  fallbackH: number,
  fallbackM: number
): { h: number; m: number } {
  if (!timeVal) return { h: fallbackH, m: fallbackM }
  if (timeVal instanceof Date) {
    return { h: timeVal.getUTCHours(), m: timeVal.getUTCMinutes() }
  }
  if (typeof timeVal === 'string') {
    const match = timeVal.match(/(\d{1,2}):(\d{2})/)
    if (match) {
      return { h: parseInt(match[1], 10), m: parseInt(match[2], 10) }
    }
  }
  return { h: fallbackH, m: fallbackM }
}

async function main() {
  // 1. Biến cấu hình ngày/tháng/tuần (truyền qua CLI arg, env TARGET_DATE, hoặc ngày hôm nay)
  const defaultDate = getTodayVN()
  const rawInput = process.env.TARGET_DATE || process.argv[2] || defaultDate

  const targetDates = resolveTargetDates(rawInput)
  const isMultiDay = targetDates.length > 1

  console.log(`📌 Phạm vi tạo dữ liệu: ${rawInput} (Tổng cộng: ${targetDates.length} ngày)`)

  // 2. Query danh sách thiết bị AIoT từ DB để gắn vào log chấm công
  const devices = await prisma.device.findMany()
  const defaultDevice = devices[0] || { name: 'FaceCam-01' }

  let totalLogsCreated = 0
  let totalSummariesCreated = 0
  let grandTotalWorkEmployees = 0
  let grandStatOnTime = 0
  let grandStatLate = 0
  let grandStatAbsent = 0
  let grandStatOff = 0

  if (!isMultiDay) {
    console.log(`\n🤖 Đang mô phỏng độ lệch ngẫu nhiên thực tế bằng Math.random()...`)
    console.log(`----------------------------------------------------------------------`)
    console.log(`MÃ NV   | HỌ TÊN                | CA LÀM VIỆC | VÀO     | RA      | KẾT QUẢ`)
    console.log(`----------------------------------------------------------------------`)
  }

  // 3. Lặp qua từng ngày trong danh sách
  for (const targetDateStr of targetDates) {
    const targetDateObj = new Date(`${targetDateStr}T00:00:00.000Z`)

    // Query lịch làm việc của ngày targetDateStr
    const schedules = await prisma.employee_shifts.findMany({
      where: {
        work_date: targetDateObj,
      },
      include: {
        employees: {
          include: {
            department: true,
            position: true,
          },
        },
        work_shifts: true,
      },
      orderBy: {
        employees: { employee_code: 'asc' },
      },
    })

    if (schedules.length === 0) {
      if (!isMultiDay) {
        const monthOfTarget = targetDateStr.slice(0, 7)
        console.error(`❌ Chưa có lịch làm việc (Schedules) cho ngày ${targetDateStr}!`)
        console.error(`👉 Vui lòng chạy Bước 2 trước để tạo lịch: npx tsx prisma/seed-shifts.ts ${monthOfTarget}`)
        process.exit(1)
      } else {
        console.warn(`⚠️ Ngày ${targetDateStr}: Chưa có lịch làm việc trong DB, bỏ qua.`)
        continue
      }
    }

    // Dọn dẹp dữ liệu cũ của ngày này để đảm bảo tính Idempotent
    const dayStartVN = new Date(`${targetDateStr}T00:00:00+07:00`)
    const dayEndVN = new Date(`${targetDateStr}T23:59:59.999+07:00`)

    await prisma.attendance_logs.deleteMany({
      where: {
        event_time: {
          gte: dayStartVN,
          lte: dayEndVN,
        },
      },
    })
    await prisma.daily_attendance_summary.deleteMany({
      where: {
        work_date: targetDateObj,
      },
    })

    const logsToCreate: Array<{
      employee_id: string
      event_time: Date
      type: string
      method: string
      device_info: string
      verification_score: number
      liveness_score: number
      status: string
    }> = []

    const summariesToCreate: Array<{
      employee_id: string
      work_date: Date
      shift_id: number
      first_check_in: Date | null
      last_check_out: Date | null
      total_working_hours: number
      late_early: number
      overtime: number
      attendance_status: string
    }> = []

    let dayStatOnTime = 0
    let dayStatLate = 0
    let dayStatAbsent = 0
    let dayStatOff = 0

    for (const schedule of schedules) {
      const emp = schedule.employees
      if (!emp) continue

      // Nếu là ca OFF (Nghỉ Chủ Nhật hoặc nghỉ theo lịch)
      if (schedule.shift_type === 'OFF') {
        summariesToCreate.push({
          employee_id: emp.id,
          work_date: targetDateObj,
          shift_id: schedule.shift_id,
          first_check_in: null,
          last_check_out: null,
          total_working_hours: 0,
          late_early: 0,
          overtime: 0,
          attendance_status: 'OFF',
        })
        dayStatOff++
        if (!isMultiDay) {
          console.log(
            `${emp.employee_code.padEnd(7)} | ${emp.full_name.padEnd(21)} | ${'Ca OFF'.padEnd(11)} | --:--   | --:--   | 🏖️ Nghỉ (OFF)`
          )
        }
        continue
      }

      // Giờ bắt đầu và kết thúc ca chuẩn
      const startTimeInfo = extractHourMinute(schedule.start_time || schedule.work_shifts?.start_time, 8, 0)
      const endTimeInfo = extractHourMinute(schedule.end_time || schedule.work_shifts?.end_time, 18, 0)

      const shiftStartMins = startTimeInfo.h * 60 + startTimeInfo.m
      const shiftEndMins = endTimeInfo.h * 60 + endTimeInfo.m

      // Mô phỏng ngẫu nhiên:
      // 80%: Đúng giờ / Sớm (0 - 10 phút)
      // 15%: Muộn (5 - 45 phút)
      // 5%: Nghỉ phép / Không chấm công (ABSENT)
      const randCheckIn = Math.random()

      let checkInDate: Date | null = null
      let checkOutDate: Date | null = null
      let lateMinutes = 0
      let earlyMinutes = 0
      let statusText = ''
      let attendanceStatus = 'PRESENT'

      if (randCheckIn >= 0.95) {
        dayStatAbsent++
        attendanceStatus = 'ABSENT'
        statusText = '❌ Vắng mặt (ABSENT)'
      } else {
        let actualCheckInMins: number
        const randomSec = Math.floor(Math.random() * 60)

        if (randCheckIn < 0.8) {
          const earlyDelta = Math.floor(Math.random() * 11)
          actualCheckInMins = shiftStartMins - earlyDelta
          dayStatOnTime++
          statusText = earlyDelta === 0 ? '✅ Đúng giờ' : `✅ Sớm ${earlyDelta}p`
        } else {
          lateMinutes = 5 + Math.floor(Math.random() * 41)
          actualCheckInMins = shiftStartMins + lateMinutes
          dayStatLate++
          statusText = `⚠️ Đi muộn ${lateMinutes}p`
        }

        checkInDate = makeVNTimestamp(targetDateStr, actualCheckInMins, randomSec)
        const selectedCamIn = devices[Math.floor(Math.random() * devices.length)] || defaultDevice

        logsToCreate.push({
          employee_id: emp.id,
          event_time: checkInDate,
          type: 'CHECK_IN',
          method: 'FACE',
          device_info: selectedCamIn.name,
          verification_score: parseFloat((0.92 + Math.random() * 0.07).toFixed(3)),
          liveness_score: parseFloat((0.95 + Math.random() * 0.04).toFixed(3)),
          status: 'VALID',
        })

        // Giờ về (checkOut):
        // 80%: Đúng giờ hoặc nán lại (0 - 15 phút)
        // 15%: Về sớm (5 - 30 phút)
        // 5%: Quên check-out
        const randCheckOut = Math.random()

        if (randCheckOut < 0.95) {
          let actualCheckOutMins: number
          const randomOutSec = Math.floor(Math.random() * 60)

          if (randCheckOut < 0.8) {
            const otDelta = Math.floor(Math.random() * 16)
            actualCheckOutMins = shiftEndMins + otDelta
          } else {
            earlyMinutes = 5 + Math.floor(Math.random() * 26)
            actualCheckOutMins = shiftEndMins - earlyMinutes
            statusText += ` & Về sớm ${earlyMinutes}p`
          }

          checkOutDate = makeVNTimestamp(targetDateStr, actualCheckOutMins, randomOutSec)
          const selectedCamOut = devices[Math.floor(Math.random() * devices.length)] || defaultDevice

          logsToCreate.push({
            employee_id: emp.id,
            event_time: checkOutDate,
            type: 'CHECK_OUT',
            method: 'FACE',
            device_info: selectedCamOut.name,
            verification_score: parseFloat((0.91 + Math.random() * 0.08).toFixed(3)),
            liveness_score: parseFloat((0.95 + Math.random() * 0.04).toFixed(3)),
            status: 'VALID',
          })
        } else {
          statusText += ' & ⚠️ Quên check-out'
        }

        if (lateMinutes > 15 && earlyMinutes > 0) {
          attendanceStatus = 'LATE_AND_EARLY'
        } else if (lateMinutes > 15) {
          attendanceStatus = 'LATE'
        } else if (earlyMinutes > 0) {
          attendanceStatus = 'EARLY_LEAVE'
        } else {
          attendanceStatus = 'PRESENT'
        }
      }

      let totalWorkingHours = 0
      if (checkInDate && checkOutDate && checkOutDate.getTime() > checkInDate.getTime()) {
        const diffMs = checkOutDate.getTime() - checkInDate.getTime()
        totalWorkingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2))
      }

      const lateEarlyHours = parseFloat(((lateMinutes + earlyMinutes) / 60).toFixed(2))
      const overtimeHours = checkOutDate
        ? Math.max(
            0,
            parseFloat(((checkOutDate.getTime() - makeVNTimestamp(targetDateStr, shiftEndMins).getTime()) / 3600000).toFixed(2))
          )
        : 0

      summariesToCreate.push({
        employee_id: emp.id,
        work_date: targetDateObj,
        shift_id: schedule.shift_id,
        first_check_in: checkInDate,
        last_check_out: checkOutDate,
        total_working_hours: totalWorkingHours,
        late_early: lateEarlyHours,
        overtime: overtimeHours,
        attendance_status: attendanceStatus,
      })

      if (!isMultiDay) {
        console.log(
          `${emp.employee_code.padEnd(7)} | ${emp.full_name.padEnd(21)} | ${(schedule.shift_type || 'OFFICE').padEnd(
            11
          )} | ${formatTimeVN(checkInDate).padEnd(7)} | ${formatTimeVN(checkOutDate).padEnd(7)} | ${statusText}`
        )
      }
    }

    // Lưu dữ liệu của ngày vào DB
    if (logsToCreate.length > 0) {
      await prisma.attendance_logs.createMany({ data: logsToCreate })
    }
    if (summariesToCreate.length > 0) {
      await prisma.daily_attendance_summary.createMany({ data: summariesToCreate })
    }

    const dayWorkCount = schedules.filter((s) => s.shift_type !== 'OFF').length
    totalLogsCreated += logsToCreate.length
    totalSummariesCreated += summariesToCreate.length
    grandTotalWorkEmployees += dayWorkCount
    grandStatOnTime += dayStatOnTime
    grandStatLate += dayStatLate
    grandStatAbsent += dayStatAbsent
    grandStatOff += dayStatOff

    if (isMultiDay) {
      const isSunday = dayStatOff === schedules.length
      if (isSunday) {
        console.log(`📅 ${targetDateStr} (Chủ Nhật): 🏖️ Tất cả ${dayStatOff} nhân viên nghỉ ca (OFF)`)
      } else {
        console.log(
          `📅 ${targetDateStr}: ${dayWorkCount} NV làm việc -> ✅ ${dayStatOnTime} Đúng giờ | ⚠️ ${dayStatLate} Muộn | ❌ ${dayStatAbsent} Vắng | 📝 ${logsToCreate.length} Logs`
        )
      }
    }
  }

  // 4. In bảng tổng kết toàn kỳ
  console.log('======================================================================')
  console.log(`📊 TỔNG KẾT CHẤM CÔNG (${rawInput}):`)
  console.log(`   - Tổng số ngày xử lý:                ${targetDates.length} ngày`)
  console.log(`   - Tổng lượt nhân viên có ca làm:    ${grandTotalWorkEmployees} lượt`)
  if (grandTotalWorkEmployees > 0) {
    console.log(
      `   - Đúng giờ / Sớm (80% mục tiêu):      ${grandStatOnTime} lượt (${Math.round(
        (grandStatOnTime / grandTotalWorkEmployees) * 100
      )}%)`
    )
    console.log(
      `   - Đi muộn (15% mục tiêu):             ${grandStatLate} lượt (${Math.round(
        (grandStatLate / grandTotalWorkEmployees) * 100
      )}%)`
    )
    console.log(
      `   - Nghỉ phép ABSENT (5% mục tiêu):     ${grandStatAbsent} lượt (${Math.round(
        (grandStatAbsent / grandTotalWorkEmployees) * 100
      )}%)`
    )
  }
  if (grandStatOff > 0) {
    console.log(`   - Lượt nghỉ ca (OFF):                 ${grandStatOff} lượt`)
  }
  console.log(`   - Tổng số lượt quẹt thẻ (Logs):        ${totalLogsCreated} lượt`)
  console.log(`   - Tổng số bản ghi summary:            ${totalSummariesCreated} bản ghi`)
  console.log('======================================================================')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed lượt chấm công:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
