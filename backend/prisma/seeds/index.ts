import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('Admin@123456', 10)
  const defaultEmployeePasswordHash = await bcrypt.hash('Employee@123456', 10)

  return prisma.$transaction(async (prisma) => {
    const existingCounts = await Promise.all([
      prisma.roles.count(), prisma.department.count(), prisma.position.count(),
      prisma.user.count(), prisma.employee.count(), prisma.device.count(),
      prisma.bonusPenalty.count(), prisma.work_shifts.count(),
    ])
    if (existingCounts.some(count => count > 0)) {
      throw new Error('Master data already exists. Seed requires an empty development database; existing data is never deleted or overwritten.')
    }

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

    // 6. Bảng Users (1 Quản trị viên Admin hệ thống)

    await prisma.user.create({
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
        hourly_rate: 90000,
      },
    ]

    for (const empData of initialEmployees) {
      const deptId = deptsMap[empData.departmentName]
      const posInfo = positionsMap[empData.positionName]
      if (!deptId || !posInfo) throw new Error(`Missing department or position for ${empData.employee_code}`)
      const isManagerPos = posInfo.level === 'MANAGER'
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
          positionId: posInfo.id,
          full_name: empData.full_name,
          phone: empData.phone.replace(/\D/g, ''),
          email: empData.email,
          hourly_rate: empData.hourly_rate,
          hourly_rate_history: [{ period: empData.created_at.toISOString().slice(0, 7), rate: empData.hourly_rate }],
          status: empData.status,
          createdAt: empData.created_at,
        },
      })
    }

    console.log('✅ 6. Bảng employees (18 nhân viên: mỗi chức vụ 1 nhân viên + 18 tài khoản User tương ứng, mật khẩu: Employee@123456)')

    // Hardware stays offline until a real heartbeat is received.
    const devicesData = [
      { name: 'PI4_FRONT_GATE', location: 'Pi Edge (ThingsBoard)', status: 'OFFLINE' },
    ]
    for (const d of devicesData) {
      await prisma.device.create({
        data: {
          name: d.name,
          location: d.location,
          ip: null,
          status: d.status,
          last_seen: null,
        },
      })
    }
    console.log(`✅ 7. Bảng devices (${devicesData.length} bản ghi)`)

    // 10. Bảng Bonus Penalty
    await prisma.bonusPenalty.create({
      data: {
        overtime_rate: 2.0,
        late_early_penalty: 1.5,
        absence_penalty_rate: 2.0,
        effective_period: initialEmployees.map(emp => emp.created_at.toISOString().slice(0, 7)).sort()[0],
        description: 'Quy định hệ số thưởng tăng ca 2.0x, phạt đi trễ/về sớm 1.5x và phạt vắng không phép 2.0x theo lương giờ',
      },
    })
    console.log('✅ 8. Bảng bonus_penalty (Hệ số OT: 2.0x, Phạt trễ/sớm: 1.5x, Phạt vắng: 2.0x)')

    console.log('======================================================================')
    console.log('🔑 THÔNG TIN TÀI KHOẢN ĐĂNG NHẬP MẶC ĐỊNH:')
    console.log('   👑 Quản trị viên (Admin):')
    console.log('      - Tên đăng nhập: admin')
    console.log('      - Mật khẩu:      Admin@123456')
    console.log('   👤 Nhân viên (18 nhân viên: NV-001 -> NV-018):')
    console.log('      - Tên đăng nhập: Mã nhân viên (ví dụ: NV-001, NV-002, ...)')
    console.log('      - Mật khẩu:      Employee@123456')
    console.log('======================================================================')
  }, { timeout: 30000 })
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi seed dữ liệu cứng:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
