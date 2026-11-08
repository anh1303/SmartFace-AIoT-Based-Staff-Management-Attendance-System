import { assertIsolatedNeonTestDatabase } from '../helpers/cloud-test-db.mjs'
import { describe, it, expect, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import * as employeeService from '../../modules/employees/employee.service.js';
import * as authService from '../../modules/auth/auth.service.js';

const enabled = process.env.RUN_POLICY_DB_TESTS === '1';
if (enabled) assertIsolatedNeonTestDatabase(process.env.DATABASE_URL, process.env.DIRECT_URL)
const suite = enabled ? describe : describe.skip;

suite('Integration Test: Tự động khởi tạo tài khoản & gửi email khi thêm nhân viên', () => {
  const testIdsToCleanup: string[] = [];

  afterAll(async () => {
    for (const code of testIdsToCleanup) {
      await employeeService.remove(code).catch(() => { });
    }
  });

  it('Khi thêm nhân viên mới: tài khoản User được tạo trong CSDL, băm mật khẩu 8 ký tự và đăng nhập thành công', async () => {
    const timestamp = Date.now();
    const testEmail = `vitest.staff.${timestamp}@smartface.aiot`;
    const testFullName = `Vitest Employee ${timestamp.toString().slice(-4)}`;

    // 1. Tạo nhân viên
    const created = await employeeService.create({
      full_name: testFullName,
      email: testEmail,
      position: 'Kỹ sư AIoT',
      department: 'Nhân viên',
      status: 'ACTIVE',
      hourly_rate: 80000,
    });

    testIdsToCleanup.push(created.employee_id);

    // 2. Kiểm tra thông tin trả về
    expect(created.employee_id).toMatch(/^NV-[0-9]+$/);
    expect(created.initial_account).toBeDefined();
    expect(created.initial_account?.username).toBe(created.employee_id);
    expect(created.initial_account?.temporary_password).toHaveLength(8);
    expect(created.initial_account?.email_sent).toBe(false);
    expect(created.email_status).toBe('not_requested'); // Direct service call has no authenticated email-job owner.

    // 3. Kiểm tra bản ghi Employee trong CSDL
    const empInDb = await prisma.employee.findUnique({
      where: { employee_code: created.employee_id },
    });
    expect(empInDb).not.toBeNull();
    expect(empInDb?.user_id).toBeTruthy();

    // 4. Kiểm tra bản ghi User trong CSDL
    const userInDb = await prisma.user.findUnique({
      where: { id: empInDb!.user_id! },
      include: { roles: true },
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb?.username).toBe(created.employee_id);
    expect(userInDb?.roles.role_name).toBe('EMPLOYEE');
    expect(userInDb?.is_active).toBe(true);

    // 5. Kiểm tra mật khẩu Bcrypt
    const rawPassword = created.initial_account!.temporary_password;
    const isPasswordMatch = await bcrypt.compare(rawPassword, userInDb!.passwordHash);
    expect(isPasswordMatch).toBe(true);

    // 6. Kiểm tra đăng nhập với tài khoản mới
    const loginRes = await authService.login({
      identifier: created.employee_id,
      password: rawPassword,
    });
    expect(loginRes.accessToken).toBeDefined();
    expect(loginRes.user.username).toBe(created.employee_id);
  }, 15000);
});
