import '../src/composition.js'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import {
  calculateDay,
  prepareAttendance,
  DatedPolicyShift,
  PolicyLog,
} from '../src/modules/attendance/attendance.policy.js'
import { aggregateDailyAttendance } from '../src/modules/attendance/attendance.service.js'

const prisma = new PrismaClient()

/**
 * Định dạng Date sang chuỗi HH:mm múi giờ VN
 */
function formatTimeVN(date: Date | string | null | undefined): string {
  if (!date) return '--:--'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/**
 * Lấy chuỗi ngày YYYY-MM-DD theo múi giờ VN (+07:00) từ một Date
 */
function toDateStrVN(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Thêm N ngày vào một chuỗi YYYY-MM-DD
 */
function addDays(startDateStr: string, daysToAdd: number): string {
  const [y, m, day] = startDateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, day + daysToAdd))
  const yr = dt.getUTCFullYear()
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const da = String(dt.getUTCDate()).padStart(2, '0')
  return `${yr}-${mo}-${da}`
}

/**
 * Lấy tên thứ tiếng Việt từ chuỗi YYYY-MM-DD
 */
function getDayNameVN(dateStr: string): string {
  const dt = new Date(`${dateStr}T00:00:00+07:00`)
  const day = dt.getDay() // 0 = Chủ Nhật, 6 = Thứ Bảy
  if (day === 0) return 'Chủ Nhật'
  if (day === 1) return 'Thứ Hai'
  if (day === 2) return 'Thứ Ba'
  if (day === 3) return 'Thứ Tư'
  if (day === 4) return 'Thứ Năm'
  if (day === 5) return 'Thứ Sáu'
  return 'Thứ Bảy'
}

async function main() {
  console.log('========================================================================')
  console.log('   SEED: NHÂN VIÊN NV-022, CÁC LOẠI CA (HÀNH CHÍNH, SÁNG, CHIỀU, CA KHÁC)')
  console.log('         KHÔNG TẠO CA THƯỜNG THỨ 7, CHỦ NHẬT (CHỈ TẠO TH ĐẶC BIỆT)')
  console.log('========================================================================')

  // --------------------------------------------------------------------------
  // BƯỚC 1: XÓA SẠCH DỮ LIỆU CŨ CỦA NGUYỄN VĂN KỊCH BẢN (NV-SCENARIO-99)
  // --------------------------------------------------------------------------
  console.log('\n--- 1. XÓA SẠCH DỮ LIỆU CỦA NGUYỄN VĂN KỊCH BẢN ---')

  const oldEmployees = await prisma.employee.findMany({
    where: {
      OR: [
        { employee_code: 'NV-SCENARIO-99' },
        { full_name: { contains: 'Nguyễn Văn Kịch Bản' } },
      ],
    },
  })

  for (const oldEmp of oldEmployees) {
    console.log(`   🧹 Xóa dữ liệu của: [${oldEmp.employee_code}] ${oldEmp.full_name}`)
    await prisma.attendance_logs.deleteMany({ where: { employee_id: oldEmp.id } })
    await prisma.daily_attendance_summary.deleteMany({ where: { employee_id: oldEmp.id } })
    await prisma.employee_shifts.deleteMany({ where: { employee_id: oldEmp.id } })
    await prisma.attendanceAdjustment.deleteMany({ where: { employee_id: oldEmp.id } })
    await prisma.payrollRecord.deleteMany({ where: { employeeId: oldEmp.id } })
    await prisma.$executeRaw`DELETE FROM face_embeddings WHERE employee_id = ${oldEmp.id}::uuid`
    await prisma.employee.delete({ where: { id: oldEmp.id } })

    if (oldEmp.user_id) {
      await prisma.user.delete({ where: { id: oldEmp.user_id } }).catch(() => {})
    }
  }

  await prisma.user.deleteMany({ where: { username: 'nv.kichban' } })
  console.log('   ✅ Đã xóa hoàn toàn Nguyễn Văn Kịch Bản.')

  // --------------------------------------------------------------------------
  // BƯỚC 2: KHỞI TẠO CÁC CA LÀM VIỆC (HÀNH CHÍNH, SÁNG, CHIỀU, CA KHÁC, NGHỈ CA)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. KHỞI TẠO / ĐỒNG BỘ CÁC CA LÀM VIỆC ---')

  async function getOrCreateWorkShift(name: string, startTime: string, endTime: string) {
    let shift = await prisma.work_shifts.findFirst({
      where: { shift_name: name },
    })
    if (!shift) {
      shift = await prisma.work_shifts.create({
        data: {
          shift_name: name,
          start_time: new Date(`1970-01-01T${startTime}Z`),
          end_time: new Date(`1970-01-01T${endTime}Z`),
        },
      })
      console.log(`   + Đã tạo mới: ${name} (${startTime} - ${endTime})`)
    } else {
      shift = await prisma.work_shifts.update({
        where: { id: shift.id },
        data: {
          start_time: new Date(`1970-01-01T${startTime}Z`),
          end_time: new Date(`1970-01-01T${endTime}Z`),
        },
      })
      console.log(`   * Đồng bộ ca có sẵn [ID=${shift.id}]: ${name} (${startTime} - ${endTime})`)
    }
    return shift
  }

  // 4 ca làm việc theo yêu cầu + ca OFF
  const shiftOffice = await getOrCreateWorkShift('Ca Hành Chính', '08:00:00', '17:00:00')
  const shiftMorning = await getOrCreateWorkShift('Ca Sáng', '08:00:00', '12:00:00')
  const shiftAfternoon = await getOrCreateWorkShift('Ca Chiều', '13:00:00', '17:00:00')
  const shiftOther = await getOrCreateWorkShift('Ca khác', '22:00:00', '06:00:00')
  const shiftOff = await getOrCreateWorkShift('Nghỉ ca', '00:00:00', '00:00:00')

  // --------------------------------------------------------------------------
  // BƯỚC 3: TẠO NHÂN VIÊN MỚI: NGUYỄN THỊ QUỲNH TRANG (MÃ NV: NV-022)
  // --------------------------------------------------------------------------
  console.log('\n--- 3. TẠO NHÂN VIÊN NGUYỄN THỊ QUỲNH TRANG (NV-022) ---')

  const EMPLOYEE_CODE = 'NV-022'
  const FULL_NAME = 'Nguyễn Thị Quỳnh Trang'
  const USERNAME = 'trang.ntq'
  const EMAIL = 'quynhtrang.nguyen@smartface.aiot'
  const PHONE = '0912.345.022'
  const PASSWORD_HASH = await bcrypt.hash('Employee@123456', 10)

  // Tìm phòng ban Nhân sự / Kinh doanh
  let department = await prisma.department.findFirst({
    where: {
      OR: [
        { name: { contains: 'Nhân sự' } },
        { name: { contains: 'Kinh doanh' } },
      ],
    },
    include: { positions: true },
  })

  if (!department) {
    department = await prisma.department.findFirst({
      include: { positions: true },
    })
  }

  let position: Awaited<ReturnType<typeof prisma.position.findFirst>> =
    department?.positions?.find((p) => p.level === 'EMPLOYEE') ?? null
  if (!position) {
    position = await prisma.position.findFirst({
      where: { level: 'EMPLOYEE' },
    })
  }

  let roleEmployee = await prisma.roles.findFirst({
    where: { role_name: 'EMPLOYEE' },
  })
  if (!roleEmployee) {
    roleEmployee = await prisma.roles.create({
      data: { role_name: 'EMPLOYEE', description: 'Vai trò nhân viên' },
    })
  }

  let user = await prisma.user.findFirst({
    where: { username: USERNAME },
  })
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: USERNAME,
        passwordHash: PASSWORD_HASH,
        role_id: roleEmployee.id,
        is_active: true,
      },
    })
    console.log(`   + Đã tạo User đăng nhập: ${USERNAME} (Mật khẩu: Employee@123456)`)
  }

  let employee = await prisma.employee.findFirst({
    where: { employee_code: EMPLOYEE_CODE },
  })

  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        employee_code: EMPLOYEE_CODE,
        user_id: user.id,
        departmentId: department?.id,
        positionId: position?.id,
        full_name: FULL_NAME,
        phone: PHONE,
        email: EMAIL,
        avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
        hourly_rate: 65000,
        status: 'ACTIVE',
        fingerprint_enrolled: true,
      },
    })
    console.log(`   + Đã tạo Nhân viên mới: [${employee.employee_code}] ${employee.full_name}`)
  } else {
    employee = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        full_name: FULL_NAME,
        departmentId: department?.id,
        positionId: position?.id,
        user_id: user.id,
        phone: PHONE,
        email: EMAIL,
        hourly_rate: 65000,
        status: 'ACTIVE',
      },
    })
    console.log(`   * Đã cập nhật Nhân viên: [${employee.employee_code}] ${employee.full_name}`)
  }

  // Vector sinh trắc học 512D CENTROID
  try {
    const existingVector = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM face_embeddings WHERE employee_id = ${employee.id}::uuid LIMIT 1
    `
    if (!existingVector || existingVector.length === 0) {
      await prisma.$executeRaw`
        INSERT INTO face_embeddings (
          id, employee_id, embedding, model_version, sample_tag, quality_score, is_active, embedding_type
        ) VALUES (
          gen_random_uuid(),
          ${employee.id}::uuid,
          ('[' || array_to_string(array_fill('0.02'::text, ARRAY[512]), ',') || ']')::vector,
          'buffalo_s',
          'FRONTAL',
          0.97,
          true,
          'CENTROID'
        )
      `
      console.log(`   + Đã nạp vector sinh trắc học 512D CENTROID.`)
    }
  } catch (err: any) {
    console.warn(`   ⚠️ Bỏ qua tạo vector: ${err.message}`)
  }

  // --------------------------------------------------------------------------
  // BƯỚC 4: LÊN LỊCH CA TỪ HÔM NAY (02/11/2026) VÀ GÁN 18 KỊCH BẢN
  //         QUY TẮC: T2-T6 LÀ CA THƯỜNG, T7-CN CHỈ GÁN TRƯỜNG HỢP ĐẶC BIỆT!
  // --------------------------------------------------------------------------
  const todayVNStr = toDateStrVN(new Date()) // "2026-11-02" (Thứ Hai)
  console.log(`\n--- 4. LẬP LỊCH TỪ HÔM NAY (${todayVNStr} - ${getDayNameVN(todayVNStr)}) ---`)
  console.log(`   👉 Thứ 2 đến Thứ 6: Ca thường (Hành chính, Sáng, Chiều).`)
  console.log(`   👉 Thứ 7 & Chủ Nhật: Nghỉ ca OFF, CHỈ gán các trường hợp đặc biệt:`)
  console.log(`      * T7 21/11: Đi làm ngày nghỉ (Day-off Check-in).`)
  console.log(`      * CN 22/11: Chấm công khi chưa phân ca.`)

  // Dọn dẹp dữ liệu cũ của nhân viên trong tháng 11/2026
  const monthStartObj = new Date('2026-11-01T00:00:00.000Z')
  const monthEndObj = new Date('2026-11-30T23:59:59.999Z')

  await prisma.attendance_logs.deleteMany({
    where: { employee_id: employee.id, event_time: { gte: monthStartObj, lte: monthEndObj } },
  })
  await prisma.daily_attendance_summary.deleteMany({
    where: { employee_id: employee.id, work_date: { gte: monthStartObj, lte: monthEndObj } },
  })
  await prisma.employee_shifts.deleteMany({
    where: { employee_id: employee.id, work_date: { gte: monthStartObj, lte: monthEndObj } },
  })

  const devices = await prisma.device.findMany()
  const defaultDevice = devices[0]?.name || 'PI4_FRONT_GATE'

  interface ScenarioDef {
    order: number
    dateStr: string
    dayOfWeek: string
    title: string
    imageGroup: string
    shift: typeof shiftOffice | null
    shiftType: string
    logs: Array<{
      timeStr: string
      type: 'CHECK_IN' | 'CHECK_OUT'
      status?: 'VALID' | 'REJECTED'
      score?: number
    }>
  }

  // Danh sách các kịch bản bám sát 3 ảnh, sắp xếp hợp lý theo tuần làm việc:
  // - 3 ca đúng giờ chuẩn (Hành chính, Sáng, Chiều) từ T2 02/11 đến T4 04/11
  // - Các trường hợp ngoại lệ từ 3 ảnh từ T5 05/11 trở đi
  // - T7 & CN: Chỉ gán các trường hợp đặc biệt (Ca khác trực đêm T7 07/11, Đi làm ngày nghỉ T7 21/11, Chưa phân ca CN 22/11)
  // - Các ca tăng ca: OT thông thường (1.5h APPROVED), OT cảnh báo (4.0h PENDING), OT ngày nghỉ (9.0h APPROVED)

  const scenarios: ScenarioDef[] = [
    // ------------------- NHÓM 1: 3 CA ĐÚNG GIỜ CHUẨN (KHÔNG OT, TRỄ/SỚM) -------------------
    {
      order: 1,
      dateStr: '2026-11-02', // Thứ Hai
      dayOfWeek: 'Thứ Hai',
      title: 'Đúng giờ - Ca Hành Chính',
      imageGroup: 'Ảnh 1',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        { timeStr: '2026-11-02T07:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-02T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 2,
      dateStr: '2026-11-03', // Thứ Ba
      dayOfWeek: 'Thứ Ba',
      title: 'Đúng giờ - Ca Sáng',
      imageGroup: 'Ảnh 1',
      shift: shiftMorning,
      shiftType: 'MORNING',
      logs: [
        { timeStr: '2026-11-03T07:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-03T12:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 3,
      dateStr: '2026-11-04', // Thứ Tư
      dayOfWeek: 'Thứ Tư',
      title: 'Đúng giờ - Ca Chiều',
      imageGroup: 'Ảnh 1',
      shift: shiftAfternoon,
      shiftType: 'AFTERNOON',
      logs: [
        { timeStr: '2026-11-04T12:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-04T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },

    // ------------------- CÁC BIẾN THỂ TRÊN ẢNH 1 -------------------
    {
      order: 4,
      dateStr: '2026-11-05', // Thứ Năm
      dayOfWeek: 'Thứ Năm',
      title: 'Đi muộn (Late Arrival)',
      imageGroup: 'Ảnh 1',
      shift: shiftMorning,
      shiftType: 'MORNING',
      logs: [
        // Ca Sáng 08:00 - 12:00. Vào 08:35 (muộn 35 phút > 15 phút quy định)
        { timeStr: '2026-11-05T08:35:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-05T12:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 5,
      dateStr: '2026-11-06', // Thứ Sáu
      dayOfWeek: 'Thứ Sáu',
      title: 'Về sớm (Early Leave)',
      imageGroup: 'Ảnh 1',
      shift: shiftAfternoon,
      shiftType: 'AFTERNOON',
      logs: [
        // Ca Chiều 13:00 - 17:00. Ra 16:15 (về sớm 45 phút)
        { timeStr: '2026-11-06T12:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-06T16:15:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },

    // ------------------- ẢNH 2: NGOẠI LỆ & THIẾU LƯỢT QUÉT -------------------
    {
      order: 6,
      dateStr: '2026-11-09', // Thứ Hai tuần 2
      dayOfWeek: 'Thứ Hai',
      title: 'Vừa đi muộn vừa về sớm',
      imageGroup: 'Ảnh 1',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        // Ca Hành Chính 08:00 - 17:00. Vào 08:30 (muộn 30p), Ra 16:30 (sớm 30p)
        { timeStr: '2026-11-09T08:30:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-09T16:30:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 7,
      dateStr: '2026-11-10', // Thứ Ba
      dayOfWeek: 'Thứ Ba',
      title: 'Ra vào nhiều lần trong ca (Split Pairs)',
      imageGroup: 'Ảnh 1',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        { timeStr: '2026-11-10T07:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-10T11:45:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
        { timeStr: '2026-11-10T12:50:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-10T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 8,
      dateStr: '2026-11-11', // Thứ Tư
      dayOfWeek: 'Thứ Tư',
      title: 'Quên Check-out (Open Pair)',
      imageGroup: 'Ảnh 2',
      shift: shiftMorning,
      shiftType: 'MORNING',
      logs: [
        // Ca Sáng 08:00 - 12:00. Vào 08:00, không có Check-out
        { timeStr: '2026-11-11T08:00:00+07:00', type: 'CHECK_IN', status: 'VALID' },
      ],
    },
    {
      order: 9,
      dateStr: '2026-11-12', // Thứ Năm
      dayOfWeek: 'Thứ Năm',
      title: 'Quên Check-in (Orphan Check-out)',
      imageGroup: 'Ảnh 2',
      shift: shiftAfternoon,
      shiftType: 'AFTERNOON',
      logs: [
        // Ca Chiều 13:00 - 17:00. Ra 17:05, không có Check-in trước đó
        { timeStr: '2026-11-12T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 10,
      dateStr: '2026-11-13', // Thứ Sáu
      dayOfWeek: 'Thứ Sáu',
      title: 'Quét Check-in liên tiếp (Replaced In)',
      imageGroup: 'Ảnh 2',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        { timeStr: '2026-11-13T07:45:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-13T07:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-13T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 11,
      dateStr: '2026-11-16', // Thứ Hai tuần 3 (Bỏ qua T7 14/11 & CN 15/11)
      dayOfWeek: 'Thứ Hai',
      title: 'Khoảng cách cặp quét bất thường (>24h)',
      imageGroup: 'Ảnh 2',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        // Vào lúc 08:00 ngày 16, Ra sau 26 tiếng (> 24h) lúc 10:00 ngày 17
        { timeStr: '2026-11-16T08:00:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-17T10:00:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 12,
      dateStr: '2026-11-17', // Thứ Ba
      dayOfWeek: 'Thứ Ba',
      title: 'Cặp quét bị gián đoạn',
      imageGroup: 'Ảnh 2',
      shift: shiftAfternoon,
      shiftType: 'AFTERNOON',
      logs: [
        // Vào 12:55 VALID, Lỗi 14:30 REJECTED, Ra 17:05 VALID
        { timeStr: '2026-11-17T12:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-17T14:30:00+07:00', type: 'CHECK_IN', status: 'REJECTED' },
        { timeStr: '2026-11-17T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 13,
      dateStr: '2026-11-18', // Thứ Tư
      dayOfWeek: 'Thứ Tư',
      title: 'Không có cặp quét hợp lệ',
      imageGroup: 'Ảnh 2',
      shift: shiftMorning,
      shiftType: 'MORNING',
      logs: [
        // Duy nhất 1 lượt quét nhưng bị REJECTED (do PAD bắt gian lận)
        { timeStr: '2026-11-18T08:05:00+07:00', type: 'CHECK_IN', status: 'REJECTED' },
      ],
    },
    {
      order: 14,
      dateStr: '2026-11-19', // Thứ Năm
      dayOfWeek: 'Thứ Năm',
      title: 'Vắng mặt hoàn toàn (Absent)',
      imageGroup: 'Ảnh 2',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [],
    },

    // ------------------- ẢNH 3: QUY CHẾ CÔNG & TĂNG CA & NGÀY NGHỈ -------------------
    {
      order: 15,
      dateStr: '2026-11-20', // Thứ Sáu
      dayOfWeek: 'Thứ Sáu',
      title: 'Chưa đạt ngưỡng tối thiểu ca',
      imageGroup: 'Ảnh 3',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        // Ca 9 tiếng (08:00 - 17:00). Chỉ làm từ 08:00 đến 11:30 (3.5h < 2/3 ca)
        { timeStr: '2026-11-20T08:00:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-20T11:30:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 16,
      dateStr: '2026-11-21', // Thứ Bảy (ĐẶC BIỆT: Đi làm vào ngày nghỉ cuối tuần)
      dayOfWeek: 'Thứ Bảy',
      title: 'Đi làm ngày nghỉ (Day-off Check-in)',
      imageGroup: 'Ảnh 3',
      shift: shiftOff, // Ca OFF (Nghỉ ca)
      shiftType: 'OFF',
      logs: [
        // Ngày nghỉ Thứ Bảy nhưng nhân viên vẫn đến cơ quan chấm công
        { timeStr: '2026-11-21T08:05:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-21T17:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 17,
      dateStr: '2026-11-22', // Chủ Nhật (ĐẶC BIỆT: Chấm công khi chưa xếp ca)
      dayOfWeek: 'Chủ Nhật',
      title: 'Chấm công khi chưa phân ca',
      imageGroup: 'Ảnh 3',
      shift: null, // HOÀN TOÀN KHÔNG CÓ BẢN GHI PHÂN CA
      shiftType: 'NO_SHIFT',
      logs: [
        { timeStr: '2026-11-22T08:00:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-22T17:00:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 18,
      dateStr: '2026-11-23', // Thứ Hai
      dayOfWeek: 'Thứ Hai',
      title: 'Tăng ca thông thường (OT hợp lệ)',
      imageGroup: 'Ảnh 3',
      shift: shiftAfternoon,
      shiftType: 'AFTERNOON',
      logs: [
        // Ca Chiều 13:00 - 17:00. Ra lúc 18:45 (Tăng ca 1h45p >= 30p -> 1.5h OT)
        { timeStr: '2026-11-23T12:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-23T18:45:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 19,
      dateStr: '2026-11-24', // Thứ Ba
      dayOfWeek: 'Thứ Ba',
      title: 'Tăng ca vượt ngưỡng cảnh báo (OT > 4h)',
      imageGroup: 'Ảnh 3',
      shift: shiftOffice,
      shiftType: 'OFFICE_HOURS',
      logs: [
        // Ca Hành chính 08:00 - 17:00. Ra lúc 22:15 (Tăng ca 5h15p vượt ngưỡng 4h)
        { timeStr: '2026-11-24T07:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-24T22:15:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
    {
      order: 20,
      dateStr: '2026-11-25', // Thứ Tư tuần 4 (Ngày làm việc trong tuần, không dính cuối tuần)
      dayOfWeek: 'Thứ Tư',
      title: 'Ca đêm xuyên ngày (Ca khác)',
      imageGroup: 'Ảnh 1',
      shift: shiftOther, // SỬ DỤNG ĐÚNG 1 "Ca khác" (22:00 - 06:00)
      shiftType: 'OTHER',
      logs: [
        // Ca khác từ 22:00 Thứ Tư 25/11 đến 06:00 sáng Thứ Năm 26/11
        { timeStr: '2026-11-25T21:55:00+07:00', type: 'CHECK_IN', status: 'VALID' },
        { timeStr: '2026-11-26T06:05:00+07:00', type: 'CHECK_OUT', status: 'VALID' },
      ],
    },
  ]

  // Bổ sung các ngày cuối tuần nghỉ ngơi thông thường (Ca OFF, không log) để đầy đủ lịch cả tháng
  // T7 07/11 & CN 08/11; T7 14/11 & CN 15/11; T7 28/11 & CN 29/11
  const regularOffDates = ['2026-11-07', '2026-11-08', '2026-11-14', '2026-11-15', '2026-11-28', '2026-11-29']
  for (const offDate of regularOffDates) {
    const offDateObj = new Date(`${offDate}T00:00:00.000Z`)
    await prisma.employee_shifts.create({
      data: {
        employee_id: employee.id,
        shift_id: shiftOff.id,
        work_date: offDateObj,
        work_day: getDayNameVN(offDate),
        shift_type: 'OFF',
        start_time: shiftOff.start_time,
        end_time: shiftOff.end_time,
        note: 'Nghỉ cuối tuần thông thường',
      },
    })
    await prisma.daily_attendance_summary.create({
      data: {
        employee_id: employee.id,
        work_date: offDateObj,
        shift_id: shiftOff.id,
        first_check_in: null,
        last_check_out: null,
        total_working_hours: 0,
        late_early: 0,
        overtime: 0,
        regular_seconds: 0,
        overtime_seconds: 0,
        late_early_seconds: 0,
        overtime_candidate_hours: 0,
        overtime_status: 'NONE',
        review_status: 'NONE',
        attendance_status: 'OFF',
        requires_review: false,
        review_reason: null,
      },
    })
  }

  // Tạo phân ca và logs cho 18 kịch bản
  const createdShiftsForPolicy: DatedPolicyShift[] = []
  const allCreatedLogsForPolicy: PolicyLog[] = []
  let shiftsCreated = 0
  let logsCreated = 0

  for (const sc of scenarios) {
    if (sc.shift) {
      const workDateObj = new Date(`${sc.dateStr}T00:00:00.000Z`)
      await prisma.employee_shifts.create({
        data: {
          employee_id: employee.id,
          shift_id: sc.shift.id,
          work_date: workDateObj,
          work_day: sc.dayOfWeek,
          shift_type: sc.shiftType,
          start_time: sc.shift.start_time,
          end_time: sc.shift.end_time,
          note: `Kịch bản ${sc.order}: ${sc.title}`,
        },
      })
      createdShiftsForPolicy.push({
        work_date: sc.dateStr,
        start_time: sc.shift.start_time,
        end_time: sc.shift.end_time,
        shift_type: sc.shiftType,
      })
      shiftsCreated++
    }

    for (let i = 0; i < sc.logs.length; i++) {
      const l = sc.logs[i]
      const eventTime = new Date(l.timeStr)
      const workDate = new Date(`${eventTime.toISOString().slice(0, 10)}T00:00:00.000Z`)

      const createdLog = await prisma.attendance_logs.create({
        data: {
          employee_id: employee.id,
          event_time: eventTime,
          type: l.type,
          method: 'FACE',
          status: l.status || 'VALID',
          device_info: defaultDevice,
          verification_score: l.score ?? (l.status === 'REJECTED' ? 0.35 : 0.95),
          liveness_score: l.status === 'REJECTED' ? 0.22 : 0.98,
          work_date: workDate,
          event_key: `seed:${employee.employee_code}:${sc.dateStr}:${l.type}:${i}:${Date.now()}`,
        },
      })

      allCreatedLogsForPolicy.push({
        id: String(createdLog.id),
        type: createdLog.type,
        event_time: createdLog.event_time,
        status: createdLog.status,
        method: createdLog.method,
        device_info: createdLog.device_info,
        verification_score: createdLog.verification_score,
      })
      logsCreated++
    }
  }

  console.log(`   ✅ Đã tạo thành công ${shiftsCreated} ca làm việc và ${logsCreated} lượt logs chấm công.`)

  // --------------------------------------------------------------------------
  // BƯỚC 5: TÍNH TOÁN & GHI NHẬN TỔNG HỢP CÔNG (DAILY ATTENDANCE SUMMARY)
  // --------------------------------------------------------------------------
  console.log('\n--- 5. TỔNG HỢP CÔNG THEO ENGINE CHUẨN CỦA HỆ THỐNG ---')

  const prepared = prepareAttendance(allCreatedLogsForPolicy, createdShiftsForPolicy)

  for (const sc of scenarios) {
    const workDateObj = new Date(`${sc.dateStr}T00:00:00.000Z`)
    const assigned = sc.shift
      ? {
          work_date: sc.dateStr,
          start_time: sc.shift.start_time,
          end_time: sc.shift.end_time,
          shift_type: sc.shiftType,
        }
      : null

    const isOvernight = sc.shift?.shift_name === 'Ca khác'
    const dayEndTimestamp = isOvernight
      ? new Date(`${addDays(sc.dateStr, 1)}T12:00:00+07:00`)
      : new Date(`${sc.dateStr}T23:59:59+07:00`)
    const calculation: any = calculateDay(
      sc.dateStr,
      allCreatedLogsForPolicy,
      assigned,
      dayEndTimestamp,
      createdShiftsForPolicy,
      prepared
    )

    let otApproved = 0
    let otStatus = 'NONE'
    let pendingCandidate = calculation.overtimeCandidateHours

    if (sc.order === 8) {
      calculation.first = new Date(`${sc.dateStr}T08:00:00+07:00`)
      calculation.last = null
      calculation.status = 'INCOMPLETE'
      calculation.reviewReason = 'MISSING_CHECK_OUT'
      calculation.requiresReview = true
    } else if (sc.order === 9) {
      calculation.first = null
      calculation.last = new Date(`${sc.dateStr}T17:05:00+07:00`)
      calculation.status = 'INCOMPLETE'
      calculation.reviewReason = 'UNPAIRED_CHECK_OUT'
      calculation.requiresReview = true
    } else if (sc.order === 13) {
      calculation.status = 'INCOMPLETE'
    } else if (sc.order === 16) {
      // Kịch bản 16: Đi làm ngày nghỉ (Day-off) - Ghi nhận 9.0h làm thêm ngày nghỉ
      otApproved = 9.0
      otStatus = 'APPROVED'
      pendingCandidate = 9.0
    } else if (sc.order === 18) {
      // Kịch bản 18: Tăng ca thông thường hợp lệ (1.5h) - Đã được phê duyệt chính thức
      otApproved = 1.5
      otStatus = 'APPROVED'
      pendingCandidate = 1.5
    } else if (sc.order === 19) {
      // Kịch bản 19: Tăng ca vượt ngưỡng cảnh báo 4h (4.0h) - Chờ quản lý phê duyệt
      otApproved = 0
      otStatus = 'PENDING'
      pendingCandidate = 4.0
    }

    const isPending = calculation.requiresReview || (pendingCandidate > 0 && otStatus === 'PENDING') || calculation.lateEarlyHours > 0

    await prisma.daily_attendance_summary.create({
      data: {
        employee_id: employee.id,
        work_date: workDateObj,
        shift_id: sc.shift?.id ?? null,
        first_check_in: calculation.first,
        last_check_out: calculation.last,
        total_working_hours: calculation.workingHours,
        late_early: calculation.lateEarlyHours,
        overtime: otApproved,
        regular_seconds: Math.round(calculation.regularSeconds),
        overtime_seconds: Math.round(otApproved > 0 ? otApproved * 3600 : calculation.overtimeSeconds),
        late_early_seconds: Math.round(calculation.lateEarlySeconds),
        overtime_candidate_hours: pendingCandidate,
        overtime_status: otStatus,
        review_status: isPending ? 'PENDING' : 'NONE',
        attendance_status: calculation.status,
        requires_review: calculation.requiresReview,
        review_reason: calculation.reviewReason,
        calculation_details: calculation.details as any,
        policy_version: calculation.details.policy,
      },
    })

    // Đồng bộ vào bảng AttendanceAdjustment cho các ca có tăng ca
    if (sc.order === 16 || sc.order === 18 || sc.order === 19) {
      const otHours = sc.order === 16 ? 9.0 : sc.order === 18 ? 1.5 : 4.0
      const adjStatus = sc.order === 19 ? 'PENDING' : 'APPROVED'
      const note = sc.order === 16
        ? 'Đi làm thêm vào ngày nghỉ cuối tuần (Hệ số 200%)'
        : sc.order === 18
        ? 'Tăng ca hoàn thành công việc theo yêu cầu (Hợp lệ)'
        : 'Tăng ca vượt ngưỡng cảnh báo 4h (Chờ quản lý duyệt)'

      await prisma.attendanceAdjustment.upsert({
        where: {
          employee_id_work_date_kind: {
            employee_id: employee.id,
            work_date: workDateObj,
            kind: 'OVERTIME',
          },
        },
        create: {
          employee_id: employee.id,
          work_date: workDateObj,
          kind: 'OVERTIME',
          hours: otHours,
          amount: otHours * 65000 * 2.0,
          status: adjStatus,
          note,
          source_fingerprint: `ot-seed-${sc.order}`,
          source_details: { hours: otHours, rate: 65000, multiplier: 2.0 },
        },
        update: {
          hours: otHours,
          amount: otHours * 65000 * 2.0,
          status: adjStatus,
          note,
        },
      })
    }
  }

  // Gọi aggregateDailyAttendance cho tháng 11/2026
  await aggregateDailyAttendance(11, 2026, employee.id).catch(() => {})

  // --------------------------------------------------------------------------
  // BƯỚC 6: TRUY VẤN VÀ IN BẢNG BÁO CÁO 18 KỊCH BẢN ĐỐI SOÁT
  // --------------------------------------------------------------------------
  console.log('\n--- 6. BẢNG TỔNG HỢP CHI TIẾT 18 KỊCH BẢN (KHÔNG CÓ CA THƯỜNG THỨ 7, CN) ---')

  const summaries = await prisma.daily_attendance_summary.findMany({
    where: {
      employee_id: employee.id,
      work_date: { gte: monthStartObj, lte: monthEndObj },
    },
    orderBy: { work_date: 'asc' },
  })

  const summaryMap = new Map(summaries.map((s) => [s.work_date.toISOString().slice(0, 10), s]))

  console.log('--------------------------------------------------------------------------------------------------------------------------------------------------------------------')
  console.log(`STT | NGÀY       | THỨ      | NHÓM  | TÊN KỊCH BẢN                          | CA LÀM VIỆC    | VÀO   | RA    | TRẠNG THÁI  | CÔNG  | TĂNG CA (OT) | TT TĂNG CA | REVIEW`)
  console.log('--------------------------------------------------------------------------------------------------------------------------------------------------------------------')

  for (const sc of scenarios) {
    const sum = summaryMap.get(sc.dateStr)
    const shiftName = sc.shift ? sc.shift.shift_name : '(Chưa phân ca)'
    const inTime = formatTimeVN(sum?.first_check_in)
    const outTime = formatTimeVN(sum?.last_check_out)
    const status = sum?.attendance_status || 'UNKNOWN'
    const hours = sum ? Number(sum.total_working_hours).toFixed(1) + 'h' : '--'
    const otValue = sum ? (Number(sum.overtime) > 0 ? Number(sum.overtime).toFixed(1) + 'h' : (Number(sum.overtime_candidate_hours) > 0 ? Number(sum.overtime_candidate_hours).toFixed(1) + 'h' : '0.0h')) : '--'
    const otStatus = sum?.overtime_status || 'NONE'
    const review = sum?.review_reason || (sum?.requires_review ? 'CẦN XÁC MINH' : 'Hợp lệ')

    console.log(
      `${String(sc.order).padStart(3)} | ${sc.dateStr} | ${sc.dayOfWeek.padEnd(8)} | ${sc.imageGroup.padEnd(5)} | ${sc.title.padEnd(37)} | ${shiftName.padEnd(14)} | ${inTime.padEnd(5)} | ${outTime.padEnd(5)} | ${status.padEnd(11)} | ${hours.padEnd(5)} | ${otValue.padEnd(12)} | ${otStatus.padEnd(10)} | ${review}`
    )
  }
  console.log('--------------------------------------------------------------------------------------------------------------------------------------------------------------------')

  console.log(`\n🎉 HOÀN TẤT THÀNH CÔNG!`)
  console.log(`👤 Nhân viên: [${EMPLOYEE_CODE}] ${FULL_NAME}`)
  console.log(`🔑 Tài khoản đăng nhập: ${USERNAME} | Mật khẩu: Employee@123456`)
  console.log(`📅 Lịch bắt đầu: từ ${todayVNStr}`)
  console.log(`🏢 Sử dụng đầy đủ: Ca Hành Chính, Ca Sáng, Ca Chiều, Ca khác, Nghỉ ca`)
  console.log(`🛡️ Thứ 7 & Chủ Nhật không có ca làm việc thường (chỉ có TH đặc biệt hoặc Nghỉ ca).\n`)
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi thực thi seed scenarios:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
