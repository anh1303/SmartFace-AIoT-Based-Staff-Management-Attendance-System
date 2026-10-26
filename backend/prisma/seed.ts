import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {

  // 1. Dọn dẹp sạch toàn bộ dữ liệu theo thứ tự quan hệ khóa ngoại
  console.log('🧹 Đang dọn dẹp sạch dữ liệu cũ...')
  await prisma.attendance_locks.deleteMany({})
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
  await prisma.position.deleteMany({})
  await prisma.department.deleteMany({})
  await prisma.roles.deleteMany({})
  await prisma.work_shifts.deleteMany({})
  console.log('✅ Đã dọn dẹp sạch dữ liệu cũ.')

  // 2. Bảng Roles (3 vai trò)
  const roleAdmin = await prisma.roles.create({
    data: { role_name: 'ADMIN', description: 'Quản trị viên toàn quyền hệ thống' },
  })
  const roleManager = await prisma.roles.create({
    data: { role_name: 'MANAGER', description: 'Quản lý phòng ban' },
  })
  const roleEmployee = await prisma.roles.create({
    data: { role_name: 'EMPLOYEE', description: 'Nhân viên thông thường' },
  })
  console.log('✅ 1. Bảng roles (3 bản ghi: ADMIN, MANAGER, EMPLOYEE)')

  // 3. Bảng Departments (6 phòng ban)
  const deptsData = [
    { code: 'HR', name: 'Nhân sự', desc: 'Quản lý tuyển dụng, chế độ phúc lợi và đào tạo nguồn nhân lực' },
    { code: 'ACC', name: 'Kế toán', desc: 'Quản lý tài chính, hạch toán kế toán và dòng tiền doanh nghiệp' },
    { code: 'SALE', name: 'Kinh doanh', desc: 'Phát triển thị trường, bán hàng và quan hệ đối tác khách hàng' },
    { code: 'MKT', name: 'Marketing', desc: 'Quảng bá thương hiệu, truyền thông số và tiếp thị sản phẩm' },
    { code: 'IT', name: 'IT', desc: 'Quản trị hạ tầng mạng, phát triển hệ thống AIoT và phần mềm' },
    { code: 'CS', name: 'CSKH', desc: 'Chăm sóc khách hàng, tiếp nhận phản hồi và hỗ trợ dịch vụ' },
  ]

  const deptsMap: Record<string, number> = {}
  for (const d of deptsData) {
    const created = await prisma.department.create({
      data: {
        department_code: d.code,
        name: d.name,
        description: d.desc,
        is_active: true,
      },
    })
    deptsMap[d.name] = created.id
  }
  console.log('✅ 2. Bảng departments (6 phòng: Nhân sự, Kế toán, Kinh doanh, Marketing, IT, CSKH)')

  // 4. Bảng Positions (18 chức vụ: Mỗi phòng có 3 chức vụ, chỉ 1 MANAGER + 2 EMPLOYEE)
  const positionsData = [
    // 1. Phòng Nhân sự
    { code: 'POS_HR_MGR', name: 'Trưởng phòng Nhân sự', dept: 'Nhân sự', level: 'MANAGER' as const },
    { code: 'POS_HR_REC', name: 'Chuyên viên Tuyển dụng', dept: 'Nhân sự', level: 'EMPLOYEE' as const },
    { code: 'POS_HR_CANDB', name: 'Chuyên viên C&B', dept: 'Nhân sự', level: 'EMPLOYEE' as const },

    // 2. Phòng Kế toán
    { code: 'POS_ACC_MGR', name: 'Kế toán trưởng', dept: 'Kế toán', level: 'MANAGER' as const },
    { code: 'POS_ACC_TH', name: 'Kế toán tổng hợp', dept: 'Kế toán', level: 'EMPLOYEE' as const },
    { code: 'POS_ACC_PAY', name: 'Kế toán tiền lương', dept: 'Kế toán', level: 'EMPLOYEE' as const },

    // 3. Phòng Kinh doanh
    { code: 'POS_SALE_MGR', name: 'Trưởng phòng Kinh doanh', dept: 'Kinh doanh', level: 'MANAGER' as const },
    { code: 'POS_SALE_ACC', name: 'Chuyên viên Quản lý khách hàng', dept: 'Kinh doanh', level: 'EMPLOYEE' as const },
    { code: 'POS_SALE_REP', name: 'Đại diện Kinh doanh', dept: 'Kinh doanh', level: 'EMPLOYEE' as const },

    // 4. Phòng Marketing
    { code: 'POS_MKT_MGR', name: 'Trưởng phòng Marketing', dept: 'Marketing', level: 'MANAGER' as const },
    { code: 'POS_MKT_CONTENT', name: 'Chuyên viên Nội dung', dept: 'Marketing', level: 'EMPLOYEE' as const },
    { code: 'POS_MKT_DIGITAL', name: 'Chuyên viên Digital Marketing', dept: 'Marketing', level: 'EMPLOYEE' as const },

    // 5. Phòng IT
    { code: 'POS_IT_MGR', name: 'Trưởng phòng CNTT', dept: 'IT', level: 'MANAGER' as const },
    { code: 'POS_IT_DEV', name: 'Kỹ sư Phần mềm', dept: 'IT', level: 'EMPLOYEE' as const },
    { code: 'POS_IT_SYS', name: 'Kỹ sư Hệ thống & AIoT', dept: 'IT', level: 'EMPLOYEE' as const },

    // 6. Phòng CSKH
    { code: 'POS_CS_MGR', name: 'Trưởng phòng CSKH', dept: 'CSKH', level: 'MANAGER' as const },
    { code: 'POS_CS_SUP', name: 'Chuyên viên Hỗ trợ khách hàng', dept: 'CSKH', level: 'EMPLOYEE' as const },
    { code: 'POS_CS_OP', name: 'Chuyên viên Trực tổng đài', dept: 'CSKH', level: 'EMPLOYEE' as const },
  ]

  const positionsMap: Record<string, { id: number; level: 'MANAGER' | 'EMPLOYEE' }> = {}
  for (const pos of positionsData) {
    const deptId = deptsMap[pos.dept]
    if (deptId) {
      const created = await prisma.position.create({
        data: {
          position_code: pos.code,
          name: pos.name,
          level: pos.level,
          departmentId: deptId,
          is_active: true,
        },
      })
      positionsMap[pos.name] = { id: created.id, level: pos.level }
    }
  }
  console.log('✅ 3. Bảng positions (18 chức vụ: 6 Quản lý MANAGER + 12 Nhân viên EMPLOYEE)')

  // 5. Bảng Work Shifts (4 ca làm việc: Ca Hành Chính, Ca Sáng, Ca Chiều, Nghỉ ca OFF)
  await prisma.work_shifts.create({
    data: {
      shift_name: 'Ca Hành Chính',
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T17:00:00.000Z'),
    },
  })
  await prisma.work_shifts.create({
    data: {
      shift_name: 'Ca Sáng',
      start_time: new Date('1970-01-01T08:00:00.000Z'),
      end_time: new Date('1970-01-01T12:00:00.000Z'),
    },
  })
  await prisma.work_shifts.create({
    data: {
      shift_name: 'Ca Chiều',
      start_time: new Date('1970-01-01T13:00:00.000Z'),
      end_time: new Date('1970-01-01T17:00:00.000Z'),
    },
  })
  await prisma.work_shifts.create({
    data: {
      shift_name: 'Ca khác',
      start_time: new Date('1970-01-01T00:00:00.000Z'),
      end_time: new Date('1970-01-01T00:00:00.000Z'),
    },
  })
  await prisma.work_shifts.create({
    data: {
      shift_name: 'Nghỉ ca',
      start_time: new Date('1970-01-01T00:00:00.000Z'),
      end_time: new Date('1970-01-01T00:00:00.000Z'),
    },
  })
  console.log('✅ 4. Bảng work_shifts (5 ca làm việc: Ca Hành Chính, Ca Sáng, Ca Chiều, Ca khác, Nghỉ ca OFF)')

  // 6. Bảng Users (1 Quản trị viên Admin hệ thống)
  const hashedPassword = await bcrypt.hash('Admin@123456', 10)
  const defaultEmployeePasswordHash = await bcrypt.hash('Employee@123456', 10)

  const adminUser = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: hashedPassword,
      role_id: roleAdmin.id,
      is_active: true,
    },
  })
  console.log('✅ 5. Bảng users (Tạo tài khoản admin hệ thống: username=admin, mật khẩu=Admin@123456)')

  // 7. Bảng Employees & Users (18 nhân viên: Mỗi chức vụ có đúng 1 nhân viên)
  const initialEmployees = [
    // --- 1. Phòng Nhân sự ---
    {
      employee_code: 'NV-001',
      full_name: 'Trần Thị Mai',
      departmentName: 'Nhân sự',
      positionName: 'Trưởng phòng Nhân sự',
      phone: '0987.654.321',
      email: 'mai.tran@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-01-15T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 160000,
    },
    {
      employee_code: 'NV-002',
      full_name: 'Lê Thu Trang',
      departmentName: 'Nhân sự',
      positionName: 'Chuyên viên Tuyển dụng',
      phone: '0912.888.999',
      email: 'trang.le@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-03-10T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 110000,
    },
    {
      employee_code: 'NV-003',
      full_name: 'Đỗ Văn Hùng',
      departmentName: 'Nhân sự',
      positionName: 'Chuyên viên C&B',
      phone: '0934.567.890',
      email: 'hung.do@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-04-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 115000,
    },

    // --- 2. Phòng Kế toán ---
    {
      employee_code: 'NV-004',
      full_name: 'Nguyễn Thị Hương',
      departmentName: 'Kế toán',
      positionName: 'Kế toán trưởng',
      phone: '0905.123.456',
      email: 'huong.nguyen@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2023-10-15T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 170000,
    },
    {
      employee_code: 'NV-005',
      full_name: 'Phạm Minh Tuấn',
      departmentName: 'Kế toán',
      positionName: 'Kế toán tổng hợp',
      phone: '0977.444.333',
      email: 'tuan.pham@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-02-15T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 120000,
    },
    {
      employee_code: 'NV-006',
      full_name: 'Hoàng Bích Ngọc',
      departmentName: 'Kế toán',
      positionName: 'Kế toán tiền lương',
      phone: '0944.555.666',
      email: 'ngoc.hoang@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-05-10T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 110000,
    },

    // --- 3. Phòng Kinh doanh ---
    {
      employee_code: 'NV-007',
      full_name: 'Vũ Hải Đăng',
      departmentName: 'Kinh doanh',
      positionName: 'Trưởng phòng Kinh doanh',
      phone: '0918.111.222',
      email: 'dang.vu@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2023-11-20T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 180000,
    },
    {
      employee_code: 'NV-008',
      full_name: 'Đặng Quỳnh Chi',
      departmentName: 'Kinh doanh',
      positionName: 'Chuyên viên Quản lý khách hàng',
      phone: '0938.222.333',
      email: 'chi.dang@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-02-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 130000,
    },
    {
      employee_code: 'NV-009',
      full_name: 'Bùi Quốc Bảo',
      departmentName: 'Kinh doanh',
      positionName: 'Đại diện Kinh doanh',
      phone: '0966.333.444',
      email: 'bao.bui@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-06-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 100000,
    },

    // --- 4. Phòng Marketing ---
    {
      employee_code: 'NV-010',
      full_name: 'Trịnh Đình Khôi',
      departmentName: 'Marketing',
      positionName: 'Trưởng phòng Marketing',
      phone: '0988.444.555',
      email: 'khoi.trinh@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2023-12-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 165000,
    },
    {
      employee_code: 'NV-011',
      full_name: 'Ngô Phương Linh',
      departmentName: 'Marketing',
      positionName: 'Chuyên viên Nội dung',
      phone: '0972.555.666',
      email: 'linh.ngo@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-03-20T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 105000,
    },
    {
      employee_code: 'NV-012',
      full_name: 'Dương Quang Huy',
      departmentName: 'Marketing',
      positionName: 'Chuyên viên Digital Marketing',
      phone: '0915.666.777',
      email: 'huy.duong@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-04-15T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 120000,
    },

    // --- 5. Phòng IT ---
    {
      employee_code: 'NV-013',
      full_name: 'Nguyễn Văn A',
      departmentName: 'IT',
      positionName: 'Trưởng phòng CNTT',
      phone: '0982.777.888',
      email: 'anv@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2023-09-01T08:00:00Z'),
      avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA0KS6nUhHdsndSeZ0LOeLkOfZAEfZAfm63Txsb3ryYsAUsiH0gLZ9VIT3CcW3uMw_MkVbDlsl53kBdUR8_KlS0J9tew5ToWiUd-q4Ct0wcosdejjVyvTptYjYHD0OY6LKozVPucFXEEHhfJqTf9_78zsEhE0xrMlMTYy2M9jxhP8ZrayoGhJz_E9WrMsLfaZlj-stHu3rWBibcwNnFos3o70DrOeSmxACoW5JdNeIoP3zwcbW4dK42',
      hourly_rate: 190000,
    },
    {
      employee_code: 'NV-014',
      full_name: 'Lê Hoàng Phúc',
      departmentName: 'IT',
      positionName: 'Kỹ sư Phần mềm',
      phone: '0933.888.999',
      email: 'phuc.le@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-01-10T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 140000,
    },
    {
      employee_code: 'NV-015',
      full_name: 'Trần Thu Thảo',
      departmentName: 'IT',
      positionName: 'Kỹ sư Hệ thống & AIoT',
      phone: '0909.999.000',
      email: 'thao.tran@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-02-25T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 135000,
    },

    // --- 6. Phòng CSKH ---
    {
      employee_code: 'NV-016',
      full_name: 'Phan Thanh Bình',
      departmentName: 'CSKH',
      positionName: 'Trưởng phòng CSKH',
      phone: '0945.111.333',
      email: 'binh.phan@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-01-05T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 150000,
    },
    {
      employee_code: 'NV-017',
      full_name: 'Lý Diệu Anh',
      departmentName: 'CSKH',
      positionName: 'Chuyên viên Hỗ trợ khách hàng',
      phone: '0976.222.444',
      email: 'anh.ly@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-04-10T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 95000,
    },
    {
      employee_code: 'NV-018',
      full_name: 'Hà Quốc Việt',
      departmentName: 'CSKH',
      positionName: 'Chuyên viên Trực tổng đài',
      phone: '0922.333.555',
      email: 'viet.ha@aiot.corp',
      status: 'ACTIVE',
      created_at: new Date('2024-05-01T08:00:00Z'),
      avatar_url: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=200&auto=format&fit=crop&q=80',
      hourly_rate: 90000,
    },
  ]

  for (const empData of initialEmployees) {
    const deptId = deptsMap[empData.departmentName] || null
    const posInfo = positionsMap[empData.positionName]
    const isManagerPos = posInfo?.level === 'MANAGER'
    const empRole = isManagerPos ? roleManager : roleEmployee

    // Tạo tài khoản User riêng biệt cho từng nhân viên (username = employee_code, mật khẩu: Employee@123456)
    const empUser = await prisma.user.create({
      data: {
        username: empData.employee_code,
        passwordHash: defaultEmployeePasswordHash,
        role_id: empRole.id,
        is_active: empData.status === 'ACTIVE',
      },
    })

    await prisma.employee.create({
      data: {
        employee_code: empData.employee_code,
        user_id: empUser.id,
        departmentId: deptId,
        positionId: posInfo ? posInfo.id : null,
        full_name: empData.full_name,
        phone: empData.phone,
        email: empData.email,
        avatar_url: empData.avatar_url,
        hourly_rate: empData.hourly_rate,
        status: empData.status,
        createdAt: empData.created_at,
      },
    })
  }

  // 8. Khởi tạo sequence employee_code_seq từ NV-019 trở đi
  await prisma.$executeRawUnsafe(`SELECT setval('employee_code_seq', 19, false);`)
  console.log('✅ 6. Bảng employees (18 nhân viên: mỗi chức vụ 1 nhân viên + 18 tài khoản User tương ứng, mật khẩu: Employee@123456)')

  // 9. Bảng Devices (4 thiết bị AIoT)
  const devicesData = [
    { name: 'FaceCam-01', location: 'Cổng vào', ip: '192.168.1.101', status: 'ONLINE' },
    { name: 'FaceCam-02', location: 'Cổng ra', ip: '192.168.1.102', status: 'ONLINE' },
    { name: 'Fingerprint-01', location: 'Cổng vào', ip: '192.168.1.103', status: 'ONLINE' },
    { name: 'Fingerprint-02', location: 'Cổng ra', ip: '192.168.1.104', status: 'ONLINE' },
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
  console.log(`✅ 7. Bảng devices (${devicesData.length} bản ghi)`)

  // 10. Bảng Bonus Penalty
  await prisma.bonusPenalty.create({
    data: {
      overtime_rate: 100000,
      late_early_penalty: 50000,
      description: 'Quy định mức thưởng tăng ca 100.000 ₫/h và phạt đi trễ/về sớm 50.000 ₫/h năm 2026',
    },
  })
  console.log('✅ 8. Bảng bonus_penalty (Mức thưởng OT: 100.000 ₫/h, Mức phạt: 50.000 ₫/h)')

  // 11. Bảng Audit Log khởi tạo hệ thống
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'INITIALIZE_MASTER_DATA',
      target_table: 'system',
      record_id: 'SYSTEM_BOOTSTRAP',
      new_values: {
        message: 'Khởi tạo dữ liệu cứng thành công với 6 phòng ban, 18 chức vụ, 1 admin, 18 nhân viên',
      },
    },
  })
  console.log('✅ 9. Bảng audit_logs (Khởi tạo log hệ thống)')

  console.log('======================================================================')
  console.log('🔑 THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH:')
  console.log('   👑 Quản trị viên (Admin):')
  console.log('      - Tên đăng nhập: admin')
  console.log('      - Mật khẩu:      Admin@123456')
  console.log('   👤 Nhân viên (18 nhân viên: NV-001 -> NV-018):')
  console.log('      - Tên đăng nhập: Mã nhân viên (ví dụ: NV-001, NV-002, ...)')
  console.log('      - Mật khẩu:      Employee@123456')
  console.log('======================================================================')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu cứng:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
