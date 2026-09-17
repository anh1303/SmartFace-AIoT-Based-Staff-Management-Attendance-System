import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Bắt đầu chạy seed dữ liệu chuẩn frontend...')

  // 1. Xóa dữ liệu cũ theo thứ tự quan hệ khóa ngoại
  await prisma.payrollRecord.deleteMany({})
  await prisma.daily_attendance_summary.deleteMany({})
  await prisma.attendance_logs.deleteMany({})
  await prisma.face_embeddings.deleteMany({})
  await prisma.employee_shifts.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.employee.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.department.deleteMany({})
  await prisma.roles.deleteMany({})
  await prisma.work_shifts.deleteMany({})

  // 2. Tạo Roles
  const roleAdmin = await prisma.roles.upsert({
    where: { role_name: 'ADMIN' },
    update: {},
    create: { role_name: 'ADMIN', description: 'Quản trị viên hệ thống' },
  })

  const roleManager = await prisma.roles.upsert({
    where: { role_name: 'MANAGER' },
    update: {},
    create: { role_name: 'MANAGER', description: 'Quản lý nhân sự' },
  })

  const roleEmployee = await prisma.roles.upsert({
    where: { role_name: 'EMPLOYEE' },
    update: {},
    create: { role_name: 'EMPLOYEE', description: 'Nhân viên thông thường' },
  })

  console.log('✅ Đã tạo Roles (ADMIN, MANAGER, EMPLOYEE)')

  // 3. Tạo Departments
  const deptsData = [
    { code: 'DEPT_AI', name: 'Kỹ thuật AI' },
    { code: 'DEPT_IT', name: 'Vận hành & IT' },
    { code: 'DEPT_HR', name: 'Nhân sự & HR' },
    { code: 'DEPT_BIZ', name: 'Kinh doanh & Dự án' },
  ]

  const depts: Record<string, { id: number; name: string }> = {}
  for (const d of deptsData) {
    const created = await prisma.department.upsert({
      where: { department_code: d.code },
      update: { name: d.name },
      create: { department_code: d.code, name: d.name },
    })
    depts[d.name] = created
  }

  console.log('✅ Đã tạo Departments')

  // 4. Tạo Work Shifts
  const shiftMorning = await prisma.work_shifts.create({
    data: {
      shift_name: 'Ca Hành Chính',
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T17:30:00.000Z'),
      grace_period_minutes: 15,
    },
  })

  console.log('✅ Đã tạo Work Shifts')

  // 5. Tạo Users (Admin, Manager, Staff)
  const hashedPassword = await bcrypt.hash('Admin@123456', 10)

  const adminUser = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: hashedPassword,
      role_id: roleAdmin.id,
      is_active: true,
    },
  })

  const managerUser = await prisma.user.upsert({
    where: { username: 'manager' },
    update: {},
    create: {
      username: 'manager',
      passwordHash: hashedPassword,
      role_id: roleManager.id,
      is_active: true,
    },
  })

  const staffUser = await prisma.user.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      passwordHash: hashedPassword,
      role_id: roleEmployee.id,
      is_active: true,
    },
  })

  console.log('✅ Đã tạo Users')

  // 6. Tạo Employees từ INITIAL_EMPLOYEES
  const initialEmployees = [
    {
      employee_code: 'NV-001',
      full_name: 'Nguyễn Văn A',
      departmentName: 'Kỹ thuật AI',
      position: 'AI Engineer Lead',
      phone: '0987.654.321',
      email: 'anv@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-01-15T08:00:00Z'),
      avatar_url:
        'https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42',
      base_salary: 22000000,
      user_id: staffUser.id,
    },
    {
      employee_code: 'NV-002',
      full_name: 'Lê Hoàng Phúc',
      departmentName: 'Vận hành & IT',
      position: 'DevOps Engineer',
      phone: '0912.888.999',
      email: 'staff@company.com',
      status: 'ACTIVE',
      created_at: new Date('2024-03-10T08:00:00Z'),
      avatar_url:
        'https://lh3.googleusercontent.com/aida/AEtjO1WI3ysdLdr6Ya6JgC-p_9Nrkual12Y1Q6p9q4Ln5kqEpHlD50Rf1fcFfWprqeiBnI7yplufSIPIriJBm7cmqB9foAoNHZen3eTFSXz2qDN7q8YMY4rzBTWQDerqU9fyTBkbyV1XkqNLbr1gaEf5pNt4z-p2XSFW0goQoox1RfdhgeYyFDqdH1XwQLMvES4M7Jxu_utGWnqzMjF1b3SMgovKmeeN--rfL1vVW2BVhMloJ9HYKfXBJ81hcv8',
      base_salary: 19500000,
      user_id: null,
    },
    {
      employee_code: 'NV-003',
      full_name: 'Nguyễn Minh Anh',
      departmentName: 'Nhân sự & HR',
      position: 'HR Operations Manager',
      phone: '0934.567.890',
      email: 'manager@company.com',
      status: 'ACTIVE',
      created_at: new Date('2023-11-01T08:00:00Z'),
      avatar_url: 'https://lh3.googleusercontent.com/aida/AEtjO1U0gZ8qJdE6oYqQ-R2V5d_h0b4VdCqX1_qZ_6M9=s256',
      base_salary: 26000000,
      user_id: managerUser.id,
    },
    {
      employee_code: 'NV-004',
      full_name: 'Trần Thu Thảo',
      departmentName: 'Kỹ thuật AI',
      position: 'Computer Vision Researcher',
      phone: '0905.123.456',
      email: 'thao.tran@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-05-20T08:00:00Z'),
      avatar_url:
        'https://lh3.googleusercontent.com/aida/AEtjO1Xw6tE-Kl6RJ0I4DImDsStSZc3dy2IU_ZbQk7wMhedEX9JhhFr0BZokHPz0wSZrZhqjYywULEMWtq5lPcL84X3aM6fdTnuWFHzAYO3Bq6xU57QOSfoPRD7TkdbT3C60GjGqI1SuN0moP_3u2hSYDZHJ_pViM0_ZPsVZizt9_RU5HK2yV0zXt5eWr5Un4rF1mMKbeZWwUieS7vg9zysgFJYqzQ9echXu2Lpdj6jcibnSkIeyv6bp8_gD3rg',
      base_salary: 21000000,
      user_id: null,
    },
    {
      employee_code: 'NV-005',
      full_name: 'Nguyễn Hải Nam',
      departmentName: 'Vận hành & IT',
      position: 'IoT Hardware Specialist',
      phone: '0977.444.333',
      email: 'nam.nguyen@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-06-15T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      base_salary: 18000000,
      user_id: null,
    },
    {
      employee_code: 'NV-006',
      full_name: 'Vũ Khánh Linh',
      departmentName: 'Kinh doanh & Dự án',
      position: 'Solutions Specialist',
      phone: '0944.555.666',
      email: 'linh.vu@aiot.corp',
      status: 'INACTIVE',
      created_at: new Date('2024-02-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      base_salary: 17000000,
      user_id: null,
    },
  ]

  const employeesMap: Record<string, any> = {}

  for (const empData of initialEmployees) {
    const deptId = depts[empData.departmentName]?.id
    const emp = await prisma.employee.upsert({
      where: { employee_code: empData.employee_code },
      update: {
        full_name: empData.full_name,
        departmentId: deptId,
        position: empData.position,
        phone: empData.phone,
        email: empData.email,
        status: empData.status,
        avatar_url: empData.avatar_url,
        base_salary: empData.base_salary,
        user_id: empData.user_id,
      },
      create: {
        employee_code: empData.employee_code,
        user_id: empData.user_id,
        departmentId: deptId,
        full_name: empData.full_name,
        position: empData.position,
        phone: empData.phone,
        email: empData.email,
        avatar_url: empData.avatar_url,
        base_salary: empData.base_salary,
        status: empData.status,
        createdAt: empData.created_at,
      },
    })
    employeesMap[empData.employee_code] = emp
  }

  console.log('✅ Đã tạo Employees (NV-001 -> NV-006)')

  // 7. Tạo Face Embeddings cho nhân viên NV-001 -> NV-005
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

  // 8. Tạo Attendance Logs mẫu
  const initialAttendance = [
    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-10T08:02:14Z', method: 'FACE', device: 'FaceCam-01', score: 0.998, status: 'VALID' },
    { code: 'NV-002', type: 'CHECK_IN', time: '2026-09-10T08:26:05Z', method: 'FACE', device: 'CAM-04', score: 0.994, status: 'VALID' },
    { code: 'NV-003', type: 'CHECK_IN', time: '2026-09-10T07:55:40Z', method: 'FACE', device: 'FaceCam-01', score: 0.999, status: 'VALID' },
    { code: 'NV-005', type: 'CHECK_IN', time: '2026-09-10T08:35:10Z', method: 'FINGERPRINT', device: 'FP-Gate-02', score: 0.985, status: 'VALID' },
    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-09T08:01:20Z', method: 'FACE', device: 'FaceCam-01', score: 0.997, status: 'VALID' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-09T17:32:00Z', method: 'FACE', device: 'FaceCam-01', score: 0.995, status: 'VALID' },
    { code: 'NV-001', type: 'CHECK_IN', time: '2026-09-08T08:00:10Z', method: 'FACE', device: 'FaceCam-01', score: 0.998, status: 'VALID' },
    { code: 'NV-001', type: 'CHECK_OUT', time: '2026-09-08T19:30:15Z', method: 'FACE', device: 'FaceCam-01', score: 0.996, status: 'VALID' },
  ]

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
    }
  }

  console.log('✅ Đã tạo Attendance Logs')

  // 9. Tạo Bảng lương mẫu (Payroll Records)
  const initialPayroll = [
    { code: 'NV-001', period: '2026-08', base: 22000000, allowance: 2500000, deduction: 1050000, total: 23450000, days: 22, hours: 176, late: 0, status: 'PENDING' },
    { code: 'NV-002', period: '2026-08', base: 19500000, allowance: 1800000, deduction: 950000, total: 20350000, days: 22, hours: 176, late: 1, status: 'PENDING' },
    { code: 'NV-003', period: '2026-08', base: 26000000, allowance: 3200000, deduction: 1300000, total: 27900000, days: 22, hours: 176, late: 0, status: 'PENDING' },
    { code: 'NV-004', period: '2026-08', base: 21000000, allowance: 2000000, deduction: 1000000, total: 22000000, days: 21, hours: 168, late: 0, status: 'PENDING' },
    { code: 'NV-005', period: '2026-08', base: 18000000, allowance: 1500000, deduction: 1200000, total: 18300000, days: 20, hours: 160, late: 3, status: 'PENDING' },
    { code: 'NV-001', period: '2026-07', base: 22000000, allowance: 2200000, deduction: 1050000, total: 23150000, days: 23, hours: 184, late: 0, status: 'FINALIZED' },
    { code: 'NV-002', period: '2026-07', base: 19500000, allowance: 1800000, deduction: 950000, total: 20350000, days: 23, hours: 184, late: 0, status: 'FINALIZED' },
    { code: 'NV-003', period: '2026-07', base: 26000000, allowance: 3200000, deduction: 1300000, total: 27900000, days: 23, hours: 184, late: 0, status: 'FINALIZED' },
  ]

  for (const pr of initialPayroll) {
    const emp = employeesMap[pr.code]
    if (emp) {
      await prisma.payrollRecord.create({
        data: {
          employeeId: emp.id,
          payroll_period: pr.period,
          base_salary: pr.base,
          allowance: pr.allowance,
          deduction: pr.deduction,
          total_paid: pr.total,
          standard_days: pr.days,
          actual_working_days: pr.days,
          total_working_hours: pr.hours,
          late_count: pr.late,
          status: pr.status,
        },
      })
    }
  }

  console.log('✅ Đã tạo Payroll Records')
  console.log('🎉 Seed dữ liệu hoàn tất thành công!')
}

main()
  .catch((e) => {
    console.error('Lỗi khi seed dữ liệu:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })