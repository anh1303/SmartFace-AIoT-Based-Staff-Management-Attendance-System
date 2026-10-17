import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, generateUniqueEmployeeCode, generateRandomPassword } from '../../common/utils.js'
import { sendAccountCredentialsEmail, type EmailSendResult } from '../../common/email.service.js'
import { logAction } from '../audit-logs/audit.service.js'
import { employeeInclude } from './employee.model.js'
import { assertCanAccessEmployeeDetail } from '../../common/permission.helper.js'

export interface RawEmployeeDb {
  id: string
  employee_code?: string | null
  full_name: string
  department?: { name?: string } | null
  position?: { id?: number; name?: string; level?: string; position_code?: string } | string | null
  positionId?: number | null
  phone?: string | null
  email?: string | null
  status?: string | null
  createdAt?: Date | null
  updatedAt?: Date | null
  face_embeddings?: unknown[] | null
  fingerprint_enrolled?: boolean | null
  avatar_url?: string | null
  hourly_rate?: { toString(): string } | number | string | bigint | null
  departmentId?: number | null
  users?: {
    id?: string
    username?: string
    is_active?: boolean
    roles?: { role_name?: string } | null
  } | null
}

export function formatEmployee(emp: RawEmployeeDb) {
  const roleName =
    emp.users?.roles?.role_name?.toUpperCase() ||
    (emp.department?.name === 'Quản lý' ? 'MANAGER' : 'EMPLOYEE')

  const posName =
    typeof emp.position === 'string'
      ? emp.position
      : emp.position?.name || ''
  const posLevel =
    typeof emp.position === 'object' && emp.position
      ? (emp.position as any).level
      : undefined

  const isManager =
    roleName === 'MANAGER' ||
    roleName === 'ADMIN' ||
    posLevel === 'MANAGER' ||
    Boolean(posName && /quản lý|manager/i.test(posName)) ||
    Boolean(emp.department?.name && /quản lý/i.test(emp.department.name))

  return {
    id: emp.id,
    employee_id: emp.employee_code || emp.id,
    username: emp.users?.username || emp.employee_code || emp.id,
    full_name: emp.full_name,
    department: emp.department?.name || '',
    position: posName,
    positionId: emp.positionId ?? (typeof emp.position === 'object' && emp.position ? (emp.position as any).id : null),
    positionLevel: posLevel,
    phone: emp.phone || '',
    email: emp.email || '',
    status: emp.status,
    role: roleName,
    is_manager: isManager,
    created_at: emp.createdAt ? emp.createdAt.toISOString() : new Date().toISOString(),
    updated_at: emp.updatedAt ? emp.updatedAt.toISOString() : new Date().toISOString(),
    face_enrolled: Array.isArray(emp.face_embeddings) && emp.face_embeddings.length > 0,
    fingerprint_enrolled: Boolean(emp.fingerprint_enrolled),
    avatar: emp.avatar_url || '',
    hourly_rate: emp.hourly_rate ? Number(emp.hourly_rate) : 0,
    departmentId: emp.departmentId,
  }
}

export async function list(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const search = typeof query.search === 'string' ? query.search : ''

  const departmentId =
    typeof query.departmentId === 'string' && query.departmentId
      ? parseInt(query.departmentId, 10)
      : undefined

  const where = {
    ...(search
      ? {
        OR: [
          { full_name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { employee_code: { contains: search, mode: 'insensitive' as const } },
        ],
      }
      : {}),
    ...(typeof query.status === 'string' ? { status: query.status } : {}),
    ...(departmentId ? { departmentId } : {}),
  }

  const [items, total] = await prisma.$transaction([
    prisma.employee.findMany({
      where,
      include: employeeInclude,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.employee.count({ where }),
  ])

  return {
    items: items.map(formatEmployee),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}



export async function get(idOrCode: string) {
  const item = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
    include: employeeInclude,
  })
  if (!item) throw new AppError(404, 'Employee not found')
  return formatEmployee(item)
}

export async function create(data: {
  employee_code?: string
  full_name: string
  email?: string | null
  position?: string | number | null
  positionId?: number | null
  position_id?: number | null
  departmentId?: number | null
  department_id?: number | null
  department?: string | null
  status?: string
  phone?: string | null
  hourly_rate?: number
  avatar?: string | null
  avatar_url?: string | null
}, actorUserId?: string) {
  let deptId = data.departmentId ?? data.department_id
  let posId = data.positionId ?? data.position_id

  if (!deptId && data.department) {
    const dept = await prisma.department.findFirst({
      where: { name: { equals: data.department.trim(), mode: 'insensitive' } },
    })
    if (dept) {
      deptId = dept.id
    } else {
      // Nếu frontend truyền tên chức vụ vào trường department
      const foundPos = await prisma.position.findFirst({
        where: { name: { equals: data.department.trim(), mode: 'insensitive' } },
      })
      if (foundPos) {
        deptId = foundPos.departmentId
        if (posId === undefined) posId = foundPos.id
      }
    }
  }

  if (posId === undefined && data.position) {
    if (typeof data.position === 'number') {
      posId = data.position
    } else if (typeof data.position === 'string' && data.position.trim()) {
      const parsedId = parseInt(data.position, 10)
      if (!isNaN(parsedId)) {
        posId = parsedId
      } else {
        const found = await prisma.position.findFirst({
          where: {
            name: { equals: data.position.trim(), mode: 'insensitive' },
            ...(deptId ? { departmentId: deptId } : {}),
          },
        })
        if (found) {
          posId = found.id
          if (!deptId) deptId = found.departmentId
        }
      }
    }
  }

  // Tự động suy ra departmentId từ position nếu chưa có
  if (!deptId && posId) {
    const p = await prisma.position.findUnique({ where: { id: posId } })
    if (p) deptId = p.departmentId
  }

  const emailVal = data.email && data.email.trim() !== '' ? data.email.trim() : null
  const codeCandidate = data.employee_code && data.employee_code.trim() !== ''
    ? data.employee_code.trim()
    : await generateUniqueEmployeeCode()

  // 1. Đảm bảo mã nhân viên là duy nhất
  const existingCode = await prisma.employee.findFirst({ where: { employee_code: codeCandidate } })
  let finalCode = existingCode ? await generateUniqueEmployeeCode() : codeCandidate

  // 2. Kiểm tra tên đăng nhập (username) trên bảng users trùng khớp với finalCode
  const existingUser = await prisma.user.findFirst({ where: { username: finalCode } })
  if (existingUser) {
    if (!data.employee_code) {
      finalCode = await generateUniqueEmployeeCode()
    } else {
      throw new AppError(409, `Tài khoản đăng nhập với username '${finalCode}' đã tồn tại trong hệ thống`)
    }
  }

  // 3. Kiểm tra tính duy nhất của email nếu được cung cấp
  if (emailVal) {
    const existingEmail = await prisma.employee.findFirst({ where: { email: emailVal } })
    if (existingEmail) {
      throw new AppError(409, `Email '${emailVal}' đã được sử dụng bởi nhân viên khác`)
    }
  }

  // 4. Sinh mật khẩu ngẫu nhiên 8 ký tự và băm mật khẩu bằng bcrypt
  const rawPassword = generateRandomPassword(8)
  const hashedPassword = await bcrypt.hash(rawPassword, 10)

  // 5. Tìm vai trò EMPLOYEE mặc định cho nhân viên mới
  const empRole = await prisma.roles.findFirst({
    where: { role_name: { equals: 'EMPLOYEE', mode: 'insensitive' } },
  })
  const fallbackRole = empRole || (await prisma.roles.findFirst())
  if (!fallbackRole) {
    throw new AppError(500, 'Không tìm thấy vai trò (roles) trong hệ thống để gán cho người dùng mới')
  }

  const rate = data.hourly_rate ?? 0

  // 6. Thực hiện tạo User và Employee đồng thời trong transaction
  const { created, user } = await prisma.$transaction(async (tx) => {
    // 6.1 Tạo tài khoản đăng nhập User mới với username = finalCode
    const newUser = await tx.user.create({
      data: {
        username: finalCode,
        passwordHash: hashedPassword,
        role_id: fallbackRole.id,
        is_active: data.status ? data.status === 'ACTIVE' : true,
      },
    })

    // 6.2 Tạo bản ghi Employee liên kết với User qua user_id
    const newEmployee = await tx.employee.create({
      data: {
        employee_code: finalCode,
        user_id: newUser.id,
        full_name: data.full_name,
        email: emailVal,
        positionId: posId ?? null,
        departmentId: deptId ?? null,
        status: data.status ?? 'ACTIVE',
        phone: data.phone || null,
        hourly_rate: rate,
        avatar_url: data.avatar_url ?? data.avatar ?? null,
      },
      include: employeeInclude,
    })

    return { created: newEmployee, user: newUser }
  })

  // 7. Ghi Audit Log hành động tạo nhân viên và tài khoản
  await logAction({
    userId: actorUserId,
    action: 'CREATE_EMPLOYEE',
    target_table: 'employees',
    record_id: created.id,
    new_values: {
      employee_code: created.employee_code,
      full_name: created.full_name,
      email: created.email,
      positionId: created.positionId,
      departmentId: created.departmentId,
      status: created.status,
      user_id: user.id,
      username: user.username,
    },
  })

  // 8. Tự động gửi email thông báo tài khoản & mật khẩu cho nhân viên
  let emailResult: EmailSendResult = { success: false, simulated: false, error: 'Không có email' }
  if (emailVal) {
    try {
      emailResult = await sendAccountCredentialsEmail({
        to: emailVal,
        fullName: created.full_name,
        employeeCode: finalCode,
        rawPassword,
        subject: `[SmartFace AIoT] Thông tin tài khoản truy cập hệ thống - ${created.full_name} (${finalCode})`,
      })
    } catch (err: any) {
      console.error('[Employee Service] Lỗi khi gửi email thông tin tài khoản:', err?.message || err)
      emailResult = { success: false, simulated: false, error: err?.message || 'Gửi email thất bại' }
    }
  }

  const formatted = formatEmployee(created)
  return {
    ...formatted,
    initial_account: {
      username: finalCode,
      temporary_password: rawPassword,
      email_sent: emailResult.success,
      simulated: emailResult.simulated ?? false,
    },
  }
}


export async function update(
  idOrCode: string,
  data: {
    full_name?: string
    email?: string | null
    position?: string | number | null
    positionId?: number | null
    position_id?: number | null
    departmentId?: number | null
    department_id?: number | null
    department?: string | null
    status?: string
    phone?: string | null
    avatar_url?: string | null
    avatar?: string | null
    hourly_rate?: number
    fingerprint_enrolled?: boolean
  },
  actorUserId?: string,
) {
  const existing = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
    include: employeeInclude,
  })
  if (!existing) throw new AppError(404, 'Employee not found')

  let deptId = data.departmentId ?? data.department_id
  let posId = data.positionId ?? data.position_id

  if (deptId === undefined && data.department) {
    const dept = await prisma.department.findFirst({
      where: { name: { equals: data.department.trim(), mode: 'insensitive' } },
    })
    if (dept) {
      deptId = dept.id
    } else {
      // Nếu frontend truyền tên chức vụ vào trường department
      const foundPos = await prisma.position.findFirst({
        where: { name: { equals: data.department.trim(), mode: 'insensitive' } },
      })
      if (foundPos) {
        deptId = foundPos.departmentId
        if (posId === undefined) posId = foundPos.id
      }
    }
  }

  if (posId === undefined && data.position !== undefined) {
    if (data.position === null) {
      posId = null
    } else if (typeof data.position === 'number') {
      posId = data.position
    } else if (typeof data.position === 'string' && data.position.trim()) {
      const parsedId = parseInt(data.position, 10)
      if (!isNaN(parsedId)) {
        posId = parsedId
      } else {
        const found = await prisma.position.findFirst({
          where: {
            name: { equals: data.position.trim(), mode: 'insensitive' },
            ...(deptId ? { departmentId: deptId } : {}),
          },
        })
        if (found) {
          posId = found.id
          if (deptId === undefined) deptId = found.departmentId
        }
      }
    }
  }

  if (deptId === undefined && posId) {
    const p = await prisma.position.findUnique({ where: { id: posId } })
    if (p) deptId = p.departmentId
  }

  const rateVal = data.hourly_rate

  const updated = await prisma.employee.update({
    where: { id: existing.id },
    data: {
      ...(data.full_name !== undefined ? { full_name: data.full_name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(posId !== undefined ? { positionId: posId } : {}),
      ...(deptId !== undefined ? { departmentId: deptId } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.avatar_url !== undefined || data.avatar !== undefined
        ? { avatar_url: data.avatar_url ?? data.avatar }
        : {}),
      ...(rateVal !== undefined ? { hourly_rate: rateVal } : {}),
    },
    include: employeeInclude,
  })

  if (existing.user_id && data.status !== undefined) {
    await prisma.user.update({
      where: { id: existing.user_id },
      data: { is_active: data.status === 'ACTIVE' },
    }).catch(() => { })
  }

  await logAction({
    userId: actorUserId,
    action: 'UPDATE_EMPLOYEE',
    target_table: 'employees',
    record_id: existing.id,
    old_values: {
      full_name: existing.full_name,
      email: existing.email,
      positionId: existing.positionId,
      departmentId: existing.departmentId,
      status: existing.status,
      hourly_rate: existing.hourly_rate ? Number(existing.hourly_rate) : 0,
    },
    new_values: {
      full_name: updated.full_name,
      email: updated.email,
      positionId: updated.positionId,
      departmentId: updated.departmentId,
      status: updated.status,
      hourly_rate: updated.hourly_rate ? Number(updated.hourly_rate) : 0,
    },
  })

  return formatEmployee(updated)
}

/**
 * 5. Xóa vĩnh viễn nhân viên khỏi cơ sở dữ liệu (Hard-delete toàn bộ quan hệ liên quan trong transaction)
 */
export async function remove(idOrCode: string, actorUserId?: string) {
  const existing = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
  })
  if (!existing) throw new AppError(404, 'Không tìm thấy nhân viên cần xóa')

  // Tuyệt đối không xóa cứng (Hard Delete / Cascade Delete) nhân sự đã phát sinh dữ liệu chấm công/lương
  // để bảo toàn lịch sử chấm công, bảng lương cũ và báo cáo chi phí kiểm toán (Audit).
  const [logCount, summaryCount, payrollCount] = await Promise.all([
    prisma.attendance_logs.count({ where: { employee_id: existing.id } }),
    prisma.daily_attendance_summary.count({ where: { employee_id: existing.id } }),
    prisma.payrollRecord.count({ where: { employeeId: existing.id } }),
  ])

  if (logCount > 0 || summaryCount > 0 || payrollCount > 0) {
    throw AppError.badRequest(
      'Không thể xóa vĩnh viễn nhân sự đã phát sinh dữ liệu chấm công hoặc bảng lương để bảo đảm toàn vẹn dữ liệu và kiểm toán (Audit). Vui lòng chuyển trạng thái nhân viên sang Đã nghỉ việc (INACTIVE)!'
    )
  }

  return prisma.$transaction(async (tx) => {
    // 1. Xóa dữ liệu sinh trắc học Face Embeddings
    await tx.face_embeddings.deleteMany({
      where: { employee_id: existing.id },
    })

    // 2. Xóa lịch sử chấm công attendance_logs
    await tx.attendance_logs.deleteMany({
      where: { employee_id: existing.id },
    })

    // 3. Xóa tổng hợp công hàng ngày daily_attendance_summary
    await tx.daily_attendance_summary.deleteMany({
      where: { employee_id: existing.id },
    })

    // 4. Xóa ca làm việc employee_shifts
    await tx.employee_shifts.deleteMany({
      where: { employee_id: existing.id },
    })

    // 5. Xóa dữ liệu bảng lương payroll_records
    await tx.payrollRecord.deleteMany({
      where: { employeeId: existing.id },
    })

    // 6. Xóa bản ghi nhân viên
    await tx.employee.delete({
      where: { id: existing.id },
    })

    // 7. Xóa tài khoản đăng nhập User liên kết (nếu có)
    if (existing.user_id) {
      await tx.user.delete({
        where: { id: existing.user_id },
      }).catch(() => { })
    }

    // 8. Ghi log kiểm toán hành động xóa vĩnh viễn
    await logAction({
      userId: actorUserId,
      action: 'DELETE_EMPLOYEE_PERMANENT',
      target_table: 'employees',
      record_id: existing.id,
      old_values: {
        employee_code: existing.employee_code,
        full_name: existing.full_name,
        email: existing.email,
        departmentId: existing.departmentId,
      },
      new_values: { deleted_permanently: true },
    })
  })
}

// Alias terminate để đảm bảo tương thích
export const terminate = remove

export async function resetPassword(idOrCode: string, actorUserId?: string) {
  const existing = await prisma.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
    include: employeeInclude,
  })
  if (!existing) throw new AppError(404, 'Không tìm thấy thông tin nhân viên')

  if (!existing.email) {
    throw new AppError(400, 'Nhân viên chưa có địa chỉ email. Vui lòng cập nhật email trước khi đặt lại mật khẩu.')
  }

  // Lấy hoặc tạo tài khoản User nếu chưa có
  let userId = existing.user_id
  let username = existing.users?.username || existing.employee_code

  const rawPassword = generateRandomPassword(8)
  const hashedPassword = await bcrypt.hash(rawPassword, 10)

  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        updated_at: new Date(),
      },
    })
  } else {
    // Nếu nhân viên chưa có User thì tạo mới
    const empRole = await prisma.roles.findFirst({
      where: { role_name: { equals: 'EMPLOYEE', mode: 'insensitive' } },
    })
    const fallbackRole = empRole || (await prisma.roles.findFirst())
    if (!fallbackRole) {
      throw new AppError(500, 'Không tìm thấy vai trò (roles) trong hệ thống')
    }

    const newUser = await prisma.user.create({
      data: {
        username: existing.employee_code,
        passwordHash: hashedPassword,
        role_id: fallbackRole.id,
        is_active: existing.status === 'ACTIVE',
      },
    })
    await prisma.employee.update({
      where: { id: existing.id },
      data: { user_id: newUser.id },
    })
    userId = newUser.id
    username = newUser.username
  }

  // Ghi audit log
  await logAction({
    userId: actorUserId,
    action: 'RESET_PASSWORD',
    target_table: 'users',
    record_id: userId,
    new_values: {
      employee_code: existing.employee_code,
      full_name: existing.full_name,
      email: existing.email,
    },
  })

  // Gửi email thông báo tài khoản & mật khẩu mới
  let emailResult: EmailSendResult = { success: false, simulated: false }
  try {
    emailResult = await sendAccountCredentialsEmail({
      to: existing.email,
      fullName: existing.full_name,
      employeeCode: username,
      rawPassword,
      subject: `[SmartFace AIoT] Đặt lại mật khẩu tài khoản truy cập hệ thống - ${existing.full_name} (${username})`,
    })
  } catch (err: any) {
    console.error('[Employee Service] Lỗi khi gửi email đặt lại mật khẩu:', err?.message || err)
    emailResult = { success: false, simulated: false, error: err?.message || 'Gửi email thất bại' }
  }

  return {
    success: true,
    message: emailResult.success
      ? `Đã đặt lại mật khẩu và gửi thông tin đến email ${existing.email} thành công!`
      : (emailResult.simulated
        ? `Đã đặt lại mật khẩu thành công (Mô phỏng gửi mail do chưa cấu hình SMTP).`
        : `Đã đặt lại mật khẩu thành công nhưng gửi email thất bại: ${emailResult.error}`),
    username,
    email: existing.email,
    temporary_password: rawPassword,
    email_sent: emailResult.success,
    simulated: emailResult.simulated ?? false,
  }
}

export async function createWithManagerCheck(
  body: any,
  actorUserId?: string,
  actorRole?: string
) {
  if (actorRole === 'MANAGER') {
    const pos = typeof body.position === 'string' ? body.position.trim() : '';
    const dept = (body.department || '').trim();
    const posId = body.positionId || body.position_id;
    let isTargetPosManager = /quản lý|manager|trưởng phòng|giám đốc|admin/i.test(pos);

    if (posId) {
      const p = await prisma.position.findUnique({ where: { id: posId } });
      if (p?.level === 'MANAGER' || /quản lý|manager|trưởng phòng|giám đốc|admin/i.test(p?.name || '')) {
        isTargetPosManager = true;
      }
    }

    if (isTargetPosManager || /quản lý|manager/i.test(dept)) {
      throw AppError.forbidden(
        'Quản lý chỉ được thêm nhân viên mới có chức vụ thông thường (không được thêm chức vụ Quản lý/Trưởng phòng)'
      );
    }
  }

  const empData = {
    ...body,
    employee_code: body.employee_code || body.employee_id,
    departmentId: body.departmentId || body.department_id,
    positionId: body.positionId || body.position_id,
  };
  return create(empData, actorUserId);
}

export async function updateWithManagerCheck(
  id: string,
  updates: any,
  actorUser?: { id?: string; role?: string }
) {
  await assertCanAccessEmployeeDetail(
    actorUser,
    id,
    'Quản lý không có quyền chỉnh sửa thông tin của quản lý khác'
  );

  if (actorUser?.role === 'MANAGER') {
    const pos = typeof updates.position === 'string' ? updates.position.trim() : '';
    const dept = (updates.department || '').trim();
    const posId = updates.positionId || updates.position_id;
    let isTargetPosManager = Boolean(pos && /quản lý|manager|trưởng phòng|giám đốc|admin/i.test(pos));

    if (posId) {
      const p = await prisma.position.findUnique({ where: { id: posId } });
      if (p?.level === 'MANAGER' || /quản lý|manager|trưởng phòng|giám đốc|admin/i.test(p?.name || '')) {
        isTargetPosManager = true;
      }
    }

    if (isTargetPosManager || (dept && /quản lý|manager/i.test(dept))) {
      throw AppError.forbidden('Quản lý không được phép gán hoặc chuyển đổi sang chức vụ Quản lý');
    }
  }

  return update(id, updates, actorUser?.id);
}

export async function getByIdWithManagerCheck(
  id: string,
  actorUser?: { id?: string; role?: string }
) {
  await assertCanAccessEmployeeDetail(
    actorUser,
    id,
    'Quản lý không có quyền xem thông tin chi tiết của quản lý khác'
  );
  return get(id);
}

