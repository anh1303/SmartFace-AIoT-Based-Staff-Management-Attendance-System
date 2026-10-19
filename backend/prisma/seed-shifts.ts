import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Danh sách thứ trong tuần
 */
const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

/**
 * Hàm kiểm tra Thứ 7, Chủ Nhật theo yêu cầu
 * @param date Đối tượng Date
 * @returns Thông tin cuối tuần (isWeekend, isSaturday, isSunday, dayName)
 */
export function isWeekend(date: Date): {
  isWeekend: boolean
  isSaturday: boolean
  isSunday: boolean
  dayName: string
} {
  const day = date.getUTCDay() // 0 = Chủ Nhật, 6 = Thứ Bảy
  return {
    isWeekend: day === 0 || day === 6,
    isSaturday: day === 6,
    isSunday: day === 0,
    dayName: DAY_NAMES[day],
  }
}

async function main() {

  // 1. Biến cấu hình tháng cần tạo lịch (mặc định lấy tháng truyền vào CLI, env TARGET_MONTH, hoặc tháng 10/2026)
  const defaultMonth = '2026-09'
  const targetMonthStr = process.env.TARGET_MONTH || process.argv[2] || defaultMonth

  if (!/^\d{4}-\d{2}$/.test(targetMonthStr)) {
    throw new Error(`Định dạng tháng không hợp lệ: "${targetMonthStr}". Vui lòng dùng định dạng YYYY-MM (ví dụ: 2026-10)`)
  }

  const [yearStr, monthStr] = targetMonthStr.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10) // 1-12
  const monthIndex = month - 1 // 0-11

  // Tính số ngày trong tháng
  const daysInMonth = new Date(year, month, 0).getDate()
  console.log(`📌 Tháng mục tiêu: ${targetMonthStr} (Tổng cộng: ${daysInMonth} ngày)`)

  // 2. Query trực tiếp từ DB: Lấy danh sách nhân viên đang hoạt động
  const employees = await prisma.employee.findMany({
    where: { status: 'ACTIVE' },
    include: {
      position: true,
      department: true,
    },
    orderBy: { employee_code: 'asc' },
  })

  if (employees.length === 0) {
    throw new Error('❌ Không tìm thấy nhân viên nào trong database! Vui lòng chạy Bước 1 trước: npm run prisma:seed')
  }
  console.log(`👥 Đã tìm thấy ${employees.length} nhân viên hoạt động từ DB.`)

  // 3. Query trực tiếp từ DB: Lấy danh mục ca làm việc (work_shifts)
  const workShifts = await prisma.work_shifts.findMany()
  if (workShifts.length === 0) {
    throw new Error('❌ Không tìm thấy ca làm việc (work_shifts) trong DB! Vui lòng chạy Bước 1 trước: npm run prisma:seed')
  }

  const shiftOffice = workShifts.find((s) => s.shift_name.toLowerCase().includes('full') || s.shift_name.toLowerCase().includes('hành chính')) || workShifts[0]
  const shiftMorning = workShifts.find((s) => s.shift_name.toLowerCase().includes('sáng')) || workShifts[1] || workShifts[0]
  const shiftAfternoon = workShifts.find((s) => s.shift_name.toLowerCase().includes('chiều')) || workShifts[2] || workShifts[0]
  const shiftOff = workShifts.find((s) => s.shift_name.toLowerCase().includes('off') || s.shift_name.toLowerCase().includes('nghỉ')) || workShifts[3] || workShifts[0]

  console.log('🏢 Các ca làm việc áp dụng:')
  console.log(`   - Hành chính: [${shiftOffice.id}] ${shiftOffice.shift_name}`)
  console.log(`   - Ca Sáng:    [${shiftMorning.id}] ${shiftMorning.shift_name}`)
  console.log(`   - Ca Chiều:   [${shiftAfternoon.id}] ${shiftAfternoon.shift_name}`)
  console.log(`   - Ca OFF:     [${shiftOff.id}] ${shiftOff.shift_name}`)

  // 4. Dọn dẹp dữ liệu lịch cũ của tháng mục tiêu để đảm bảo tính Idempotent
  const periodStart = new Date(Date.UTC(year, monthIndex, 1))
  const periodEnd = new Date(Date.UTC(year, monthIndex + 1, 1))

  const deletedOldShifts = await prisma.employee_shifts.deleteMany({
    where: {
      work_date: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
  })
  console.log(`🧹 Đã dọn dẹp ${deletedOldShifts.count} bản ghi lịch làm việc cũ trong tháng ${targetMonthStr}.`)

  // 5. Sinh danh sách lịch làm việc cho từng nhân viên và từng ngày trong tháng
  const shiftRecordsToCreate: Array<{
    employee_id: string
    shift_id: number
    work_date: Date
    work_day: string
    shift_type: string
    start_time: Date | null
    end_time: Date | null
    note: string
  }> = []

  let countOff = 0
  let countOffice = 0
  let countMorning = 0
  let countAfternoon = 0

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0')
    const workDate = new Date(`${yearStr}-${monthStr}-${dayStr}T00:00:00.000Z`)
    const weekendInfo = isWeekend(workDate)

    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const emp = employees[empIdx]
      const isManager = emp.position?.level === 'MANAGER'

      // Quy luật gán lịch:
      // - Nếu là Chủ Nhật: Công ty nghỉ Chủ Nhật -> gán ca OFF
      // - Thứ 2 đến Thứ 7: Phân phối đều ca sáng / chiều / hành chính để dữ liệu sinh động
      if (weekendInfo.isSunday) {
        shiftRecordsToCreate.push({
          employee_id: emp.id,
          shift_id: shiftOff.id,
          work_date: workDate,
          work_day: weekendInfo.dayName,
          shift_type: 'OFF',
          start_time: null,
          end_time: null,
          note: 'Nghỉ Chủ Nhật hàng tuần',
        })
        countOff++
      } else if (weekendInfo.isSaturday) {
        // Thứ 7: Các Quản lý và khối văn phòng phân phối ca sáng và hành chính
        const satMod = (empIdx + day) % 2
        if (satMod === 0) {
          shiftRecordsToCreate.push({
            employee_id: emp.id,
            shift_id: shiftMorning.id,
            work_date: workDate,
            work_day: weekendInfo.dayName,
            shift_type: 'MORNING',
            start_time: shiftMorning.start_time,
            end_time: shiftMorning.end_time,
            note: 'Lịch làm việc Thứ Bảy ca sáng',
          })
          countMorning++
        } else {
          shiftRecordsToCreate.push({
            employee_id: emp.id,
            shift_id: shiftOffice.id,
            work_date: workDate,
            work_day: weekendInfo.dayName,
            shift_type: 'OFFICE_HOURS',
            start_time: shiftOffice.start_time,
            end_time: shiftOffice.end_time,
            note: 'Lịch làm việc Thứ Bảy hành chính',
          })
          countOffice++
        }
      } else {
        // Thứ Hai đến Thứ Sáu:
        // Quản lý (MANAGER) giữ nhịp ca hành chính ổn định
        // Nhân viên phân phối đều 3 ca: Sáng / Chiều / Hành chính
        let assignedShift = shiftOffice
        let assignedType = 'OFFICE_HOURS'
        let note = 'Ca hành chính chuẩn'

        if (isManager) {
          assignedShift = shiftOffice
          assignedType = 'OFFICE_HOURS'
          note = 'Lịch quản trị phòng ban hành chính'
          countOffice++
        } else {
          const shiftCycle = (empIdx * 2 + day) % 3
          if (shiftCycle === 0) {
            assignedShift = shiftOffice
            assignedType = 'OFFICE_HOURS'
            note = 'Lịch phân công ca hành chính'
            countOffice++
          } else if (shiftCycle === 1) {
            assignedShift = shiftMorning
            assignedType = 'MORNING'
            note = 'Lịch phân công ca sáng'
            countMorning++
          } else {
            assignedShift = shiftAfternoon
            assignedType = 'AFTERNOON'
            note = 'Lịch phân công ca chiều'
            countAfternoon++
          }
        }

        shiftRecordsToCreate.push({
          employee_id: emp.id,
          shift_id: assignedShift.id,
          work_date: workDate,
          work_day: weekendInfo.dayName,
          shift_type: assignedType,
          start_time: assignedShift.start_time,
          end_time: assignedShift.end_time,
          note,
        })
      }
    }
  }

  // 6. Lưu vào DB thông qua createMany
  console.log(`💾 Đang lưu ${shiftRecordsToCreate.length} bản ghi ca làm việc vào database...`)
  await prisma.employee_shifts.createMany({
    data: shiftRecordsToCreate,
  })

  console.log('======================================================================')
  console.log(`📊 Thống kê chi tiết:`)
  console.log(`   - Tổng số ca được tạo:       ${shiftRecordsToCreate.length} ca`)
  console.log(`   - Ca Hành chính (Full time): ${countOffice} ca (${Math.round((countOffice / shiftRecordsToCreate.length) * 100)}%)`)
  console.log(`   - Ca Sáng:                   ${countMorning} ca (${Math.round((countMorning / shiftRecordsToCreate.length) * 100)}%)`)
  console.log(`   - Ca Chiều:                  ${countAfternoon} ca (${Math.round((countAfternoon / shiftRecordsToCreate.length) * 100)}%)`)
  console.log(`   - Ca Nghỉ (OFF Chủ Nhật):    ${countOff} ca (${Math.round((countOff / shiftRecordsToCreate.length) * 100)}%)`)
  console.log('======================================================================')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed lịch làm việc:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
