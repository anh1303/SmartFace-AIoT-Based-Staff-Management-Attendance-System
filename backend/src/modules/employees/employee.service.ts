import { formatEmployee } from './employee.format.js'
export { formatEmployee, type RawEmployeeDb } from './employee.format.js'
import type { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { enqueueOperation, findOperationByKey } from '../operations/operation.service.js'
import { prisma } from '../../config/database.js'
import { AppError } from '../../common/AppError.js'
import { buildIdOrCodeWhere, generateRandomPassword } from '../../common/utils.js'
import { generateUniqueEmployeeCode } from './employee.code.js'
import { sendAccountCredentialsEmail, type EmailSendResult } from '../../common/email.service.js'
import { logAction } from '../audit-logs/public.js'
import {
  findAuthUserByUsername,
  createAuthUser,
  updateAuthUser,
  getDefaultRole,
  deleteAuthUser,
} from '../auth/public.js'
import { deleteBiometricsForEmployee } from '../biometrics/public.js'
import { deleteShiftsForEmployee } from '../shifts/public.js'
import { employeeInclude } from './employee.model.js'
import { recordHourlyRateChange } from './employee.wage.js'
import { vnDay, payrollPeriodLockKey } from '../../common/utils.js'
import { nextPayrollPeriod } from '../../common/payroll-policy.js'
import { hasAttendanceActivity } from '../attendance/public.js'
import { hasPayrollActivity } from '../payroll/public.js'
import { assertCanAccessEmployeeDetail, assertCanManageEmployee, getEmployeeScope, isEmployeeManager, type EmployeeActor } from './employee.permission.js'

export async function list(query: Record<string, unknown>, actor?: EmployeeActor) {
  const scope = await getEmployeeScope(actor)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  const search = typeof query.search === 'string' ? query.search : ''

  const departmentId =
    typeof query.departmentId === 'string' && query.departmentId
      ? parseInt(query.departmentId, 10)
      : undefined

  const where = {
    AND: [scope],
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
  fingerprint_enrolled?: boolean | null
}, actorUserId?: string, actorRole?: string, operation?: { key: string; fingerprint: unknown }) {
  if (operation && actorUserId) {
    const previous = await findOperationByKey(actorUserId, operation.key, 'employee.create', operation.fingerprint)
    if (previous) return { ...(await get(previous.result.employeeId)), email_status: 'queued', initial_account: undefined }
  }
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

  // 2. Kiểm tra tên đăng nhập (username) trên bảng users trùng khớp với finalCode qua auth module
  const existingUser = await findAuthUserByUsername(finalCode)
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

  // 5. Tìm vai trò EMPLOYEE mặc định cho nhân viên mới qua auth module
  const fallbackRole = await getDefaultRole()
  if (!fallbackRole || fallbackRole.role_name.toUpperCase() !== 'EMPLOYEE') {
    throw new AppError(500, 'Không tìm thấy vai trò (roles) trong hệ thống để gán cho người dùng mới')
  }

  const rate = data.hourly_rate ?? 0

  // 6. Thực hiện tạo User và Employee đồng thời trong transaction
  const { created, replayed } = await prisma.$transaction(async (tx) => {
    if (operation && actorUserId) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`operation:${actorUserId}:${operation.key}`}))`
      const previous = await findOperationByKey(actorUserId, operation.key, 'employee.create', operation.fingerprint, tx)
      if (previous) {
        const created = await tx.employee.findUniqueOrThrow({ where: { id: previous.result.employeeId }, include: employeeInclude })
        return { created, replayed: true }
      }
    }
    if (actorRole?.toUpperCase() === 'MANAGER') {
      await getEmployeeScope({ id: actorUserId, role: actorRole }, 'manage', tx)
      const self = await tx.employee.findFirst({ where: { user_id: actorUserId } })
      if (!self?.departmentId || self.departmentId !== deptId) throw AppError.forbidden('Employee department changed; refresh before creating staff')
    }
    // 6.1 Tạo tài khoản đăng nhập User mới qua auth module API
    const newUser = await createAuthUser(
      {
        username: finalCode,
        passwordHash: hashedPassword,
        role_id: fallbackRole.id,
        is_active: data.status ? data.status === 'ACTIVE' : true,
      },
      tx
    )

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
        fingerprint_enrolled: false,
      },
      include: employeeInclude,
    })

    await tx.auditLog.create({ data: { userId: actorUserId, action: 'CREATE_EMPLOYEE', target_table: 'employees', record_id: newEmployee.id,
      new_values: { employee_code: finalCode, full_name: newEmployee.full_name, user_id: newUser.id } } })
    if (operation && actorUserId) {
      const accepted = await enqueueOperation(tx, { ownerId: actorUserId, key: operation.key, type: 'employee.create', label: `Tạo nhân viên ${finalCode}`, payload: {}, fingerprint: operation.fingerprint })
      await tx.$executeRaw`UPDATE background_operations SET status = 'succeeded', completed = 1, succeeded = 1, result = ${JSON.stringify({ employeeId: newEmployee.id })}::jsonb WHERE id = ${accepted.jobId}::uuid`
    }
    if (emailVal && actorUserId) await enqueueOperation(tx, { ownerId: actorUserId, key: randomUUID(), type: 'employee.email', label: `Gửi email tài khoản ${finalCode}`,
      payload: { employeeId: newEmployee.id }, secret: { to: emailVal, fullName: newEmployee.full_name, employeeCode: finalCode, rawPassword, passwordHash: hashedPassword } })
    return { created: newEmployee, replayed: false }
  })

  return { ...formatEmployee(created), email_status: emailVal && actorUserId ? 'queued' : 'not_requested',
    initial_account: replayed ? undefined : { username: created.employee_code, temporary_password: rawPassword, email_sent: false, simulated: false } }
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
    expectedVersion?: string
  },
  actorUserId?: string,
  tx?: Prisma.TransactionClient,
): Promise<ReturnType<typeof formatEmployee>> {
  if (!tx) return prisma.$transaction(client => update(idOrCode, data, actorUserId, client))
  const client = tx
  const currentPeriod = vnDay(new Date()).slice(0, 7)
  const ratePeriod = nextPayrollPeriod(currentPeriod)
  if (data.hourly_rate !== undefined && typeof (tx as any).$executeRaw === 'function') {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payrollPeriodLockKey(ratePeriod)}))`
  }
  if (data.expectedVersion && typeof client.$executeRaw === 'function') {
    await client.$executeRaw`SELECT id FROM employees WHERE employee_code = ${idOrCode} OR id::text = ${idOrCode} FOR UPDATE`
  }
  const existing = await client.employee.findFirst({
    where: buildIdOrCodeWhere(idOrCode),
    include: employeeInclude,
  })
  if (!existing) throw new AppError(404, 'Employee not found')
  if (data.expectedVersion && existing.updatedAt.toISOString() !== data.expectedVersion) throw AppError.conflict('Nhân viên đã được cập nhật bởi thao tác khác. Vui lòng tải lại thông tin trước khi sửa.')


  let deptId = data.departmentId ?? data.department_id
  let posId = data.positionId ?? data.position_id

  if (deptId === undefined && data.department) {
    const dept = await client.department.findFirst({
      where: { name: { equals: data.department.trim(), mode: 'insensitive' } },
    })
    if (dept) {
      deptId = dept.id
    } else {
      // Nếu frontend truyền tên chức vụ vào trường department
      const foundPos = await client.position.findFirst({
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
        const found = await client.position.findFirst({
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
    const p = await client.position.findUnique({ where: { id: posId } })
    if (p) deptId = p.departmentId
  }

  const rateVal = data.hourly_rate

  const updated = await client.employee.update({
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
      ...(rateVal !== undefined && rateVal !== Number(existing.hourly_rate ?? 0) ? { hourly_rate_history: recordHourlyRateChange(existing, rateVal, ratePeriod) } : {}),

    },
    include: employeeInclude,
  })

  if (existing.user_id && data.status !== undefined) {
    await updateAuthUser(existing.user_id, { is_active: data.status === 'ACTIVE' }, client)
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
  const [hasAttendance, hasPayroll] = await Promise.all([
    hasAttendanceActivity(existing.id),
    hasPayrollActivity(existing.id),
  ])

  if (hasAttendance || hasPayroll) {
    throw AppError.badRequest(
      'Không thể xóa vĩnh viễn nhân sự đã phát sinh dữ liệu chấm công hoặc bảng lương để bảo đảm toàn vẹn dữ liệu và kiểm toán (Audit). Vui lòng chuyển trạng thái nhân viên sang Đã nghỉ việc (INACTIVE)!'
    )
  }

  return prisma.$transaction(async (tx) => {
    // 1. Xóa dữ liệu sinh trắc học Face Embeddings qua Biometrics module contract
    await deleteBiometricsForEmployee(existing.id, tx)

    // 2. Xóa ca làm việc qua Shifts module contract
    await deleteShiftsForEmployee(existing.id, tx)

    // 3. Xóa bản ghi nhân viên
    await tx.employee.delete({
      where: { id: existing.id },
    })

    // 7. Xóa tài khoản đăng nhập User liên kết (nếu có)
    if (existing.user_id) {
      await deleteAuthUser(existing.user_id, tx).catch(() => { })
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

export async function resetPassword(idOrCode: string, actorUserId?: string, actorRole?: string) {
  await assertCanManageEmployee({ id: actorUserId, role: actorRole }, idOrCode)
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
    await updateAuthUser(userId, {
      passwordHash: hashedPassword,
      updated_at: new Date(),
    })
  } else {
    // Nếu nhân viên chưa có User thì tạo mới qua auth module
    const fallbackRole = await getDefaultRole()
    if (!fallbackRole || fallbackRole.role_name.toUpperCase() !== 'EMPLOYEE') {
      throw new AppError(500, 'Không tìm thấy vai trò (roles) trong hệ thống')
    }

    const newUser = await createAuthUser({
      username: existing.employee_code,
      passwordHash: hashedPassword,
      role_id: fallbackRole.id,
      is_active: existing.status === 'ACTIVE',
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

async function scopeEmployeeChanges(body: any, actor?: EmployeeActor) {
  if (actor?.role?.toUpperCase() === 'ADMIN') return body;
  if (actor?.role?.toUpperCase() !== 'MANAGER' || !actor.id) throw AppError.forbidden('Employee management denied');
  const self = await prisma.employee.findFirst({ where: { user_id: actor.id } });
  if (!self?.departmentId) throw AppError.forbidden('A department is required to manage employees');
  for (const key of ['departmentId', 'department_id']) {
    if (body[key] !== undefined && body[key] !== self.departmentId) throw AppError.forbidden('Cannot move employees outside your department');
  }
  if (body.department) {
    const department = await prisma.department.findFirst({ where: { name: { equals: String(body.department).trim(), mode: 'insensitive' } } });
    if (department?.id !== self.departmentId) throw AppError.forbidden('Cannot manage another department');
  }
  let positionId = body.positionId ?? body.position_id;
  if (positionId === undefined && body.position != null && body.position !== '') {
    const candidate = Number(body.position);
    if (Number.isInteger(candidate) && candidate > 0) positionId = candidate;
    else {
      const position = await prisma.position.findFirst({ where: { departmentId: self.departmentId, name: { equals: String(body.position).trim(), mode: 'insensitive' } } });
      if (!position || isEmployeeManager({ position })) throw AppError.forbidden('Invalid staff position');
      positionId = position.id;
    }
  }
  if (positionId != null) {
    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position || position.departmentId !== self.departmentId || isEmployeeManager({ position })) throw AppError.forbidden('Invalid staff position');
  }
  return { ...body, departmentId: self.departmentId, ...(positionId !== undefined ? { positionId } : {}) };
}

export async function createWithManagerCheck(
  body: any,
  actorUserId?: string,
  actorRole?: string,
  operation?: { key: string; fingerprint: unknown }
) {
  body = await scopeEmployeeChanges(body, { id: actorUserId, role: actorRole });
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
  return create(empData, actorUserId, actorRole, operation);
}

export async function updateWithManagerCheck(
  id: string,
  updates: any,
  actorUser?: { id?: string; role?: string }
) {
  await assertCanManageEmployee(actorUser, id);
  updates = await scopeEmployeeChanges(updates, actorUser);

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

  return prisma.$transaction(async tx => {
    await assertCanManageEmployee(actorUser, id, tx);
    return update(id, updates, actorUser?.id, tx);
  });
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

export async function setFingerprintEnrolledStatus(employeeId: string, enrolled: boolean, tx?: Prisma.TransactionClient) {
  const client = tx || prisma
  return client.employee.update({ where: { id: employeeId }, data: { fingerprint_enrolled: enrolled } })
}

export {
  getEmployeeClient,
  findEmployeeByIdOrCode,
  findEmployeesByIds,
  findActiveEmployees,
  findActiveEmployeeIds,
  findEmployeeByUserId,
  findEmployeeByEmail,
  createEmployee,
  countActiveEmployees,
  findEmployeeByIdOrUserId,
  countScopedEmployees,
  terminateEmployee,
  findEmployeesWithFilter,
  findEmployeeWageProfile,
  findEmployeeWithRelations,
} from './employee.queries.js'
