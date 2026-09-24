import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Bắt đầu seed toàn bộ dữ liệu mẫu chuẩn cho 12 bảng trong CSDL...')

  // 1. Xóa sạch dữ liệu cũ theo thứ tự quan hệ khóa ngoại
  await prisma.bonusPenalty.deleteMany({})
  await prisma.payrollRecord.deleteMany({})
  await prisma.daily_attendance_summary.deleteMany({})
  await prisma.attendance_logs.deleteMany({})
  await prisma.face_embeddings.deleteMany({})
  await prisma.employee_shifts.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.device.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.department.deleteMany({})
  await prisma.roles.deleteMany({})
  await prisma.work_shifts.deleteMany({})

  console.log('🧹 Đã dọn dẹp toàn bộ dữ liệu cũ.')

  // 2. Bảng 1: Roles
  const roleAdmin = await prisma.roles.create({
    data: { role_name: 'ADMIN', description: 'Quản trị viên hệ thống' },
  })
  const roleManager = await prisma.roles.create({
    data: { role_name: 'MANAGER', description: 'Quản lý nhân sự' },
  })
  const roleEmployee = await prisma.roles.create({
    data: { role_name: 'EMPLOYEE', description: 'Nhân viên thông thường' },
  })
  console.log('✅ 1. Bảng roles (3 bản ghi)')

  // 3. Bảng 2: Departments
  const deptsData = [
    { code: 'Manager', name: 'Quản lý' },
    { code: 'Cashier', name: 'Thu ngân' },
    { code: 'Staff', name: 'Nhân viên' },
    { code: 'Security', name: 'Bảo vệ' },
  ]
  const deptsMap: Record<string, number> = {}
  for (const d of deptsData) {
    const created = await prisma.department.create({
      data: { department_code: d.code, name: d.name },
    })
    deptsMap[d.name] = created.id
  }
  console.log('✅ 2. Bảng departments (4 bản ghi)')

  // 4. Bảng 3: Work Shifts
  const shiftOffice = await prisma.work_shifts.create({
    data: {
      shift_name: 'Full time',
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T18:00:00.000Z'),
    },
  })
  const shiftMorning = await prisma.work_shifts.create({
    data: {
      shift_name: 'Part time: Ca sáng',
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T12:00:00.000Z'),
    },
  })
  const shiftAfternoon = await prisma.work_shifts.create({
    data: {
      shift_name: 'Part time: Ca chiều',
      start_time: new Date('1970-01-01T13:00:00.000Z'),
      end_time: new Date('1970-01-01T18:00:00.000Z'),
    },
  })
  console.log('✅ 3. Bảng work_shifts (3 bản ghi)')

  // 5. Bảng 4: Users
  const hashedPassword = await bcrypt.hash('Admin@123456', 10)
  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: hashedPassword,
      role_id: roleAdmin.id,
      is_active: true,
    },
  })
  const managerUser = await prisma.user.create({
    data: {
      username: 'manager',
      passwordHash: hashedPassword,
      role_id: roleManager.id,
      is_active: true,
    },
  })
  const employeeUser = await prisma.user.create({
    data: {
      username: 'employee',
      passwordHash: hashedPassword,
      role_id: roleEmployee.id,
      is_active: true,
    },
  })
  console.log('✅ 4. Bảng users (3 bản ghi)')

  // 6. Bảng 5: Employees
  const initialEmployees = [
    {
      employee_code: 'NV-001',
      full_name: 'Nguyễn Văn A',
      departmentName: 'Quản lý',
      position: 'Quản lý chính',
      phone: '0987.654.321',
      email: 'anv@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-01-15T08:00:00Z'),
      avatar_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42',
      hourly_rate: 120000,
      user_id: employeeUser.id,
    },
    {
      employee_code: 'NV-002',
      full_name: 'Lê Hoàng Phúc',
      departmentName: 'Thu ngân',
      position: 'Thu ngân chính',
      phone: '0912.888.999',
      email: 'staff@company.com',
      status: 'ACTIVE',
      created_at: new Date('2024-03-10T08:00:00Z'),
      avatar_url:
        'https://lh3.googleusercontent.com/aida/AEtjO1WI3ysdLdr6Ya6JgC-p_9Nrkual12Y1Q6p9q4Ln5kqEpHlD50Rf1fcFfWprqeiBnI7yplufSIPIriJBm7cmqB9foAoNHZen3eTFSXz2qDN7q8YMY4rzBTWQDerqU9fyTBkbyV1XkqNLbr1gaEf5pNt4z-p2XSFW0goQoox1RfdhgeYyFDqdH1XwQLMvES4M7Jxu_utGWnqzMjF1b3SMgovKmeeN--rfL1vVW2BVhMloJ9HYKfXBJ81hcv8',
      hourly_rate: 110000,
      user_id: null,
    },
    {
      employee_code: 'NV-003',
      full_name: 'Nguyễn Minh Anh',
      departmentName: 'Quản lý',
      position: 'Trưởng phòng quản lý',
      phone: '0934.567.890',
      email: 'manager@company.com',
      status: 'ACTIVE',
      created_at: new Date('2023-11-01T08:00:00Z'),
      avatar_url: 'https://lh3.googleusercontent.com/aida/AEtjO1U0gZ8qJdE6oYqQ-R2V5d_h0b4VdCqX1_qZ_6M9=s256',
      hourly_rate: 150000,
      user_id: managerUser.id,
    },
    {
      employee_code: 'NV-004',
      full_name: 'Trần Thu Thảo',
      departmentName: 'Nhân viên',
      position: 'Nhân viên bán hàng',
      phone: '0905.123.456',
      email: 'thao.tran@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-05-20T08:00:00Z'),
      avatar_url:
        'https://lh3.googleusercontent.com/aida/AEtjO1Xw6tE-Kl6RJ0I4DImDsStSZc3dy2IU_ZbQk7wMhedEX9JhhFr0BZokHPz0wSZrZhqjYywULEMWtq5lPcL84X3aM6fdTnuWFHzAYO3Bq6xU57QOSfoPRD7TkdbT3C60GjGqI1SuN0moP_3u2hSYDZHJ_pViM0_ZPsVZizt9_RU5HK2yV0zXt5eWr5Un4rF1mMKbeZWwUieS7vg9zysgFJYqzQ9echXu2Lpdj6jcibnSkIeyv6bp8_gD3rg',
      hourly_rate: 125000,
      user_id: null,
    },
    {
      employee_code: 'NV-005',
      full_name: 'Nguyễn Hải Nam',
      departmentName: 'Bảo vệ',
      position: 'Nhân viên an ninh',
      phone: '0977.444.333',
      email: 'nam.nguyen@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-06-15T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 100000,
      user_id: null,
    },
    {
      employee_code: 'NV-006',
      full_name: 'Vũ Khánh Linh',
      departmentName: 'Thu ngân',
      position: 'Thu ngân dự phòng',
      phone: '0944.555.666',
      email: 'linh.vu@aiot.corp',
      status: 'INACTIVE',
      created_at: new Date('2024-02-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 95000,
      user_id: null,
    },
  ]

  const employeesMap: Record<string, any> = {}
  for (const empData of initialEmployees) {
    const deptId = deptsMap[empData.departmentName] || null
    const emp = await prisma.employee.create({
      data: {
        employee_code: empData.employee_code,
        user_id: empData.user_id,
        departmentId: deptId,
        full_name: empData.full_name,
        position: empData.position,
        phone: empData.phone,
        email: empData.email,
        avatar_url: empData.avatar_url,
        hourly_rate: empData.hourly_rate,
        status: empData.status,
        createdAt: empData.created_at,
      },
    })
    employeesMap[empData.employee_code] = emp
  }
  console.log('✅ 5. Bảng employees (6 bản ghi)')

  // 7. Bảng 6: Employee Shifts
  const rawShifts = [
    // Tuần 36 (07/09/2026 -> 12/09/2026)
    { code: 'NV-001', date: '2026-09-07', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-08', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time + OT 1h', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-09', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-10', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-001', date: '2026-09-11', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-12', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },

    { code: 'NV-002', date: '2026-09-07', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-08', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-09', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-10', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-11', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-12', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },

    { code: 'NV-003', date: '2026-09-07', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-08', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-09', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-10', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-11', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },

    { code: 'NV-004', date: '2026-09-07', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-08', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-09', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-10', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-11', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },

    { code: 'NV-005', date: '2026-09-07', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-08', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-09', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-10', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-11', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-12', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },

    // Tuần 37 (14/09/2026 -> 20/09/2026)
    { code: 'NV-001', date: '2026-09-14', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-15', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-001', date: '2026-09-16', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-17', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-001', date: '2026-09-18', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-19', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-001', date: '2026-09-20', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng CN', shift_id: shiftMorning.id },

    { code: 'NV-002', date: '2026-09-14', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-15', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-16', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-17', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-18', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },
    { code: 'NV-002', date: '2026-09-19', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-002', date: '2026-09-20', start: '08:00', end: '12:00', type: 'MORNING', note: 'Part time: Ca sáng', shift_id: shiftMorning.id },

    { code: 'NV-003', date: '2026-09-14', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-15', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-16', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-17', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-18', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-003', date: '2026-09-19', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },

    { code: 'NV-004', date: '2026-09-14', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-15', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-16', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-17', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-18', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-19', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },
    { code: 'NV-004', date: '2026-09-20', start: '13:00', end: '18:00', type: 'AFTERNOON', note: 'Part time: Ca chiều', shift_id: shiftAfternoon.id },

    { code: 'NV-005', date: '2026-09-14', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-15', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-16', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-17', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-18', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-19', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
    { code: 'NV-005', date: '2026-09-20', start: '08:00', end: '18:00', type: 'OFFICE_HOURS', note: 'Full time', shift_id: shiftOffice.id },
  ]

  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  let shiftCount = 0
  for (const s of rawShifts) {
    const emp = employeesMap[s.code]
    if (emp) {
      const dayIndex = new Date(`${s.date}T00:00:00.000Z`).getUTCDay();
      const workDay = dayNames[dayIndex];
      await prisma.employee_shifts.create({
        data: {
          employee_id: emp.id,
          shift_id: s.shift_id,
          work_date: new Date(`${s.date}T00:00:00.000Z`),
          work_day: workDay,
          shift_type: s.type,
          start_time: s.start,
          end_time: s.end,
          note: s.note || '',
        },
      })
      shiftCount++
    }
  }
  console.log(`✅ 6. Bảng employee_shifts (${shiftCount} bản ghi)`)

  // 8. Bảng 7: Devices
  const devicesData = [
    { name: 'FaceCam-01', location: 'Cổng chính - Tầng 1', ip: '192.168.1.101', status: 'ONLINE' },
    { name: 'FaceCam-02', location: 'Cổng phòng R&D - Tầng 2', ip: '192.168.1.102', status: 'ONLINE' },
    { name: 'FP-Gate-02', location: 'Máy chấm công vân tay Cổng B', ip: '192.168.1.103', status: 'ONLINE' },
    { name: 'CAM-04', location: 'Camera Giám sát Khu Xưởng', ip: '192.168.1.104', status: 'OFFLINE' },
  ]
  for (const d of devicesData) {
    await prisma.device.create({
      data: {
        name: d.name,
        location: d.location,
        ip: d.ip,
        status: d.status,
        last_seen: new Date(),
      },
    })
  }
  console.log('✅ 7. Bảng devices (4 bản ghi)')

  // 9. Bảng 8: Face Embeddings
  for (const code of ['NV-001', 'NV-002', 'NV-003', 'NV-004', 'NV-005']) {
    const emp = employeesMap[code]
    if (emp) {
      await prisma.face_embeddings.create({
        data: {
          employee_id: emp.id,
          embedding: Array(128).fill(0).map(() => parseFloat(Math.random().toFixed(4))),
          model_version: 'arcface_v1',
          sample_tag: 'FRONTAL',
          quality_score: 0.98,
          is_active: true,
        },
      })
    }
  }
  console.log('✅ 8. Bảng face_embeddings (5 bản ghi)')

  // 10. Bảng 9: Attendance Logs (Đảm bảo độ lệch checkin/checkout không quá 1h so với ca)
  // 10. Bảng 9: Attendance Logs (Đảm bảo độ lệch checkin/checkout không quá 1h so với ca, múi giờ +07:00 GMT+7)
  const initialAttendance = [
    // --- Ngày 19/09/2026 ---
    // NV-001 (Full time 08:00 - 18:00): Vào ca 08:01:00, hết ca 18:00:00
    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-19T08:01:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-19T18:00:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },

    // NV-002 (Full time 08:00 - 18:00): Vào ca 08:26:00, hết ca 17:35:00
    { code: 'NV-002', type: 'CHECK_IN', time: '2026-09-19T08:26:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.97, status: 'LATE' },
    { code: 'NV-002', type: 'CHECK_OUT', time: '2026-09-19T17:35:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.96, status: 'EARLY_LEAVE' },

    // NV-003 (Full time 08:00 - 18:00): Vào ca 07:55:40, hết ca 17:02:10
    { code: 'NV-003', type: 'CHECK_IN', time: '2026-09-19T07:55:40+07:00', method: 'FACE', device: 'FaceCam-01', score: 1.0, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_OUT', time: '2026-09-19T17:02:10+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.98, status: 'EARLY_LEAVE' },

    // NV-004 (Ca chiều 13:00 - 18:00): Vào ca 13:01:15, hết ca 18:30:00
    { code: 'NV-004', type: 'CHECK_IN', time: '2026-09-19T13:01:15+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_OUT', time: '2026-09-19T18:30:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.99, status: 'ON_TIME' },

    // NV-005 (Full time 08:00 - 18:00): Vào ca 08:35:10, hết ca 18:40:00
    { code: 'NV-005', type: 'CHECK_IN', time: '2026-09-19T08:35:10+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.98, status: 'LATE' },
    { code: 'NV-005', type: 'CHECK_OUT', time: '2026-09-19T18:40:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.98, status: 'ON_TIME' },

    // --- Quá khứ Tuần 37 ---
    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-18T07:58:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-18T18:00:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_IN', time: '2026-09-18T07:55:00+07:00', method: 'FACE', device: 'CAM-04', score: 0.98, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_OUT', time: '2026-09-18T12:05:00+07:00', method: 'FACE', device: 'CAM-04', score: 0.98, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_IN', time: '2026-09-18T07:57:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_OUT', time: '2026-09-18T18:02:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_IN', time: '2026-09-18T13:00:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_OUT', time: '2026-09-18T18:45:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-005', type: 'CHECK_IN', time: '2026-09-18T07:59:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.98, status: 'ON_TIME' },
    { code: 'NV-005', type: 'CHECK_OUT', time: '2026-09-18T18:00:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.98, status: 'ON_TIME' },

    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-17T13:01:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-17T18:40:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_IN', time: '2026-09-17T08:15:00+07:00', method: 'FACE', device: 'CAM-04', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_OUT', time: '2026-09-17T12:05:00+07:00', method: 'FACE', device: 'CAM-04', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_IN', time: '2026-09-17T08:00:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_OUT', time: '2026-09-17T18:15:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_IN', time: '2026-09-17T13:03:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.98, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_OUT', time: '2026-09-17T18:30:00+07:00', method: 'FACE', device: 'FaceCam-02', score: 0.98, status: 'ON_TIME' },
    { code: 'NV-005', type: 'CHECK_IN', time: '2026-09-17T08:20:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.98, status: 'LATE' },
    { code: 'NV-005', type: 'CHECK_OUT', time: '2026-09-17T18:40:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.98, status: 'ON_TIME' },

    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-16T08:15:20+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'LATE' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-16T18:01:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_IN', time: '2026-09-16T08:10:00+07:00', method: 'FACE', device: 'CAM-04', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_OUT', time: '2026-09-16T12:10:00+07:00', method: 'FACE', device: 'CAM-04', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_IN', time: '2026-09-16T07:55:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-003', type: 'CHECK_OUT', time: '2026-09-16T18:00:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },

    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-15T08:10:10+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-15T12:00:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-002', type: 'CHECK_IN', time: '2026-09-15T08:25:10+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.97, status: 'LATE' },
    { code: 'NV-002', type: 'CHECK_OUT', time: '2026-09-15T12:00:00+07:00', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.97, status: 'ON_TIME' },

    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-14T08:01:15+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-14T18:02:00+07:00', method: 'FACE', device: 'FaceCam-01', score: 0.99, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_IN', time: '2026-09-14T13:05:00+07:00', method: 'MANUAL', device: 'Kiosk-Lobby', score: 1.0, status: 'ON_TIME' },
    { code: 'NV-004', type: 'CHECK_OUT', time: '2026-09-14T18:00:00+07:00', method: 'MANUAL', device: 'Kiosk-Lobby', score: 1.0, status: 'ON_TIME' },
  ]

  let logCount = 0
  for (const att of initialAttendance) {
    const emp = employeesMap[att.code]
    if (emp) {
      await prisma.attendance_logs.create({
        data: {
          employee_id: emp.id,
          event_time: new Date(att.time),
          type: att.type,
          method: att.method,
          device_info: att.device,
          verification_score: att.score,
          status: att.status,
        },
      })
      logCount++
    }
  }
  console.log(`✅ 9. Bảng attendance_logs (${logCount} bản ghi)`)

  // 11. Bảng 10: Daily Attendance Summary
  // Tổng hợp tự động từ attendance_logs theo employee_id + work_date
  function roundTo30Minutes(seconds: number): number {
    if (seconds <= 0) return 0;
    return Math.round(seconds / 1800) * 1800;
  }

  function parseTimeToSeconds(timeIso: string | null): number | null {
    if (!timeIso) return null;
    const d = new Date(timeIso);
    if (isNaN(d.getTime())) return null;
    const parts = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false }).split(':');
    return parseInt(parts[0] || '0', 10) * 3600 + parseInt(parts[1] || '0', 10) * 60 + parseInt(parts[2] || '0', 10);
  }

  function calculateSummaryMetrics(
    shiftStartStr: string = '08:00',
    shiftEndStr: string = '18:00',
    checkInIso: string | null,
    checkOutIso: string | null
  ) {
    const [sH, sM] = shiftStartStr.split(':').map(Number);
    const [eH, eM] = shiftEndStr.split(':').map(Number);
    const startSec = sH * 3600 + (sM || 0) * 60;
    const endSec = eH * 3600 + (eM || 0) * 60;

    const inSec = parseTimeToSeconds(checkInIso);
    const outSec = parseTimeToSeconds(checkOutIso);

    let lateSec = 0;
    if (inSec !== null && inSec > startSec) {
      lateSec = inSec - startSec;
    }

    let earlySec = 0;
    if (outSec !== null && outSec < endSec) {
      earlySec = endSec - outSec;
    }

    const rawLateEarly = lateSec + earlySec;
    const late_early = rawLateEarly > 0 ? roundTo30Minutes(rawLateEarly) : 0;

    let overtime = 0;
    if (inSec !== null && outSec !== null) {
      let actualWorkSec = outSec - inSec;
      if (actualWorkSec < 0) actualWorkSec += 86400;

      let shiftWorkSec = endSec - startSec;
      if (shiftWorkSec < 0) shiftWorkSec += 86400;

      const rawOTSec = actualWorkSec - shiftWorkSec;
      if (rawOTSec > 0) {
        overtime = roundTo30Minutes(rawOTSec);
      }
    }

    return { late_early, overtime };
  }

  const summariesData = [
    { code: 'NV-001', date: '2026-09-19', checkIn: '2026-09-19T08:01:00+07:00', checkOut: '2026-09-19T18:00:00+07:00', status: 'PRESENT' },
    { code: 'NV-002', date: '2026-09-19', checkIn: '2026-09-19T08:26:00+07:00', checkOut: '2026-09-19T17:35:00+07:00', status: 'PRESENT' },
    { code: 'NV-003', date: '2026-09-19', checkIn: '2026-09-19T07:55:40+07:00', checkOut: '2026-09-19T17:02:10+07:00', status: 'PRESENT' },
    { code: 'NV-004', date: '2026-09-19', checkIn: '2026-09-19T13:01:15+07:00', checkOut: '2026-09-19T18:30:00+07:00', status: 'PRESENT' },
    { code: 'NV-005', date: '2026-09-19', checkIn: '2026-09-19T08:35:10+07:00', checkOut: '2026-09-19T18:40:00+07:00', status: 'LATE' },

    { code: 'NV-001', date: '2026-09-18', checkIn: '2026-09-18T07:58:00+07:00', checkOut: '2026-09-18T18:00:00+07:00', status: 'PRESENT' },
    { code: 'NV-002', date: '2026-09-18', checkIn: '2026-09-18T07:55:00+07:00', checkOut: '2026-09-18T12:05:00+07:00', status: 'PRESENT' },
    { code: 'NV-003', date: '2026-09-18', checkIn: '2026-09-18T07:57:00+07:00', checkOut: '2026-09-18T18:02:00+07:00', status: 'PRESENT' },
    { code: 'NV-004', date: '2026-09-18', checkIn: '2026-09-18T13:00:00+07:00', checkOut: '2026-09-18T18:45:00+07:00', status: 'PRESENT' },
    { code: 'NV-005', date: '2026-09-18', checkIn: '2026-09-18T07:59:00+07:00', checkOut: '2026-09-18T18:00:00+07:00', status: 'PRESENT' },

    { code: 'NV-001', date: '2026-09-17', checkIn: '2026-09-17T13:01:00+07:00', checkOut: '2026-09-17T18:40:00+07:00', status: 'PRESENT' },
    { code: 'NV-002', date: '2026-09-17', checkIn: '2026-09-17T08:15:00+07:00', checkOut: '2026-09-17T12:05:00+07:00', status: 'PRESENT' },
    { code: 'NV-003', date: '2026-09-17', checkIn: '2026-09-17T08:00:00+07:00', checkOut: '2026-09-17T18:15:00+07:00', status: 'PRESENT' },
    { code: 'NV-004', date: '2026-09-17', checkIn: '2026-09-17T13:03:00+07:00', checkOut: '2026-09-17T18:30:00+07:00', status: 'PRESENT' },
    { code: 'NV-005', date: '2026-09-17', checkIn: '2026-09-17T08:20:00+07:00', checkOut: '2026-09-17T18:40:00+07:00', status: 'LATE' },
  ]

  let sumCount = 0
  for (const sum of summariesData) {
    const emp = employeesMap[sum.code]
    if (emp) {
      const metrics = calculateSummaryMetrics('08:00', '17:30', sum.checkIn, sum.checkOut);
      await prisma.daily_attendance_summary.create({
        data: {
          employee_id: emp.id,
          work_date: new Date(`${sum.date}T00:00:00.000Z`),
          shift_id: shiftOffice.id,
          first_check_in: sum.checkIn ? new Date(sum.checkIn) : null,
          last_check_out: sum.checkOut ? new Date(sum.checkOut) : null,
          late_early: metrics.late_early,
          overtime: metrics.overtime,
          attendance_status: sum.status,
        },
      })
      sumCount++
    }
  }
  console.log(`✅ 10. Bảng daily_attendance_summary (${sumCount} bản ghi)`)

  // 12. Bảng 11: Bonus Penalty
  await prisma.bonusPenalty.create({
    data: {
      overtime_rate: 100000,
      late_early_penalty: 50000,
      description: 'Quy định mức thưởng tăng ca 100.000 ₫/h và phạt đi trễ/về sớm 50.000 ₫/h năm 2026',
    },
  })
  console.log('✅ 11. Bảng bonus_penalty (Mức thưởng OT: 100.000 ₫/h, Mức phạt: 50.000 ₫/h)')

  // 13. Bảng 12: Payroll Records
  const initialPayroll = [
    // Kỳ 2026-09 (Kỳ hiện tại)
    { code: 'NV-001', period: '2026-09', hourly: 120000, ot: 4.0, late: 0, allowance: 2500000, net: 23900000, status: 'PENDING' },
    { code: 'NV-002', period: '2026-09', hourly: 110000, ot: 1.5, late: 0.5, allowance: 1800000, net: 21100000, status: 'PENDING' },
    { code: 'NV-003', period: '2026-09', hourly: 150000, ot: 6.0, late: 0, allowance: 3200000, net: 30200000, status: 'PENDING' },
    { code: 'NV-004', period: '2026-09', hourly: 125000, ot: 2.0, late: 0, allowance: 2000000, net: 24200000, status: 'PENDING' },
    { code: 'NV-005', period: '2026-09', hourly: 100000, ot: 3.5, late: 1.5, allowance: 1500000, net: 19275000, status: 'PENDING' },

    // Kỳ 2026-08 (Đã chốt)
    { code: 'NV-001', period: '2026-08', hourly: 120000, ot: 5.5, late: 0, allowance: 2500000, net: 24170000, status: 'FINALIZED' },
    { code: 'NV-002', period: '2026-08', hourly: 110000, ot: 2.0, late: 1.0, allowance: 1800000, net: 21310000, status: 'FINALIZED' },
    { code: 'NV-003', period: '2026-08', hourly: 150000, ot: 8.0, late: 0, allowance: 3200000, net: 30400000, status: 'FINALIZED' },
    { code: 'NV-004', period: '2026-08', hourly: 125000, ot: 0, late: 0.5, allowance: 2000000, net: 23975000, status: 'FINALIZED' },
    { code: 'NV-005', period: '2026-08', hourly: 100000, ot: 4.0, late: 2.5, allowance: 1500000, net: 19375000, status: 'FINALIZED' },

    // Kỳ 2026-07 (Đã chốt)
    { code: 'NV-001', period: '2026-07', hourly: 120000, ot: 3.0, late: 0, allowance: 2200000, net: 24580000, status: 'FINALIZED' },
    { code: 'NV-002', period: '2026-07', hourly: 110000, ot: 0, late: 0, allowance: 1800000, net: 22040000, status: 'FINALIZED' },
    { code: 'NV-003', period: '2026-07', hourly: 150000, ot: 6.5, late: 0, allowance: 3200000, net: 31450000, status: 'FINALIZED' },
    { code: 'NV-004', period: '2026-07', hourly: 125000, ot: 1.0, late: 0, allowance: 2000000, net: 24100000, status: 'FINALIZED' },
    { code: 'NV-005', period: '2026-07', hourly: 100000, ot: 2.0, late: 1.0, allowance: 1500000, net: 19150000, status: 'FINALIZED' },

    // Kỳ 2026-06 (Đã chốt)
    { code: 'NV-001', period: '2026-06', hourly: 120000, ot: 2.0, late: 0, allowance: 2200000, net: 24480000, status: 'FINALIZED' },
    { code: 'NV-002', period: '2026-06', hourly: 110000, ot: 1.0, late: 0, allowance: 1800000, net: 22140000, status: 'FINALIZED' },
    { code: 'NV-003', period: '2026-06', hourly: 150000, ot: 5.0, late: 0, allowance: 3200000, net: 31100000, status: 'FINALIZED' },

    // Kỳ 2026-05 (Đã chốt)
    { code: 'NV-001', period: '2026-05', hourly: 120000, ot: 1.0, late: 0, allowance: 2200000, net: 24380000, status: 'FINALIZED' },
    { code: 'NV-002', period: '2026-05', hourly: 110000, ot: 0, late: 0.5, allowance: 1800000, net: 22015000, status: 'FINALIZED' },
    { code: 'NV-003', period: '2026-05', hourly: 150000, ot: 4.0, late: 0, allowance: 3200000, net: 30800000, status: 'FINALIZED' },
  ]

  let prCount = 0
  for (const pr of initialPayroll) {
    const emp = employeesMap[pr.code]
    if (emp) {
      await prisma.payrollRecord.create({
        data: {
          employeeId: emp.id,
          payroll_period: pr.period,
          hourly_rate: pr.hourly,
          total_overtime: pr.ot,
          total_late_early: pr.late,
          allowance: pr.allowance,
          net_salary: pr.net,
          status: pr.status,
        },
      })
      prCount++
    }
  }
  console.log(`✅ 12. Bảng payroll_records (${prCount} bản ghi)`)

  // 13. Bảng 12: Audit Logs
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'INITIALIZE_SYSTEM',
      target_table: 'system',
      record_id: 'SYSTEM_BOOTSTRAP',
      new_values: { message: 'Khởi tạo hệ thống SmartFace AIoT thành công' },
    },
  })
  await prisma.auditLog.create({
    data: {
      userId: managerUser.id,
      action: 'CREATE_SHIFTS',
      target_table: 'employee_shifts',
      record_id: 'WEEK_37',
      new_values: { message: 'Phân ca làm việc tuần 37 thành công' },
    },
  })
  console.log('✅ 12. Bảng audit_logs (2 bản ghi)')

  console.log('🎉 Hoàn tất seed dữ liệu cho 12/12 bảng thành công!')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })