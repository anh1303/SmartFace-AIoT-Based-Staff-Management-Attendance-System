/** Explicit, development-only preview adapter. Never a fallback for a failed real API. */
import type { ApiResponse } from '../types/api.types';
import type { Employee, WorkShift, AttendanceRecord, PayrollRecord } from '../types';
import type { AttendanceAdjustment } from '../features/payrolls/components/AdjustmentReviewPanel';
import type { Device, DeviceMode } from '../features/devices/deviceApi';
import { calcPayrollAmount } from '../utils/payrollUtils';
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
const period = today.slice(0, 7);
const now = () => new Date().toISOString();
const stamp = (date: string, hour: string) => `${date}T${hour}:00+07:00`;
export const demoEmployees: Employee[] = ['Nguyễn Minh An', 'Trần Bảo Linh', 'Lê Hoàng Nam', 'Phạm Thu Hà'].map((name, i) => ({ id: `demo-employee-${i + 1}`, employee_id: `NV00${i + 1}`, full_name: name, department: i < 3 ? 'Vận hành' : 'Nhân sự', position: i === 0 ? 'Trưởng nhóm' : 'Chuyên viên', email: `employee${i + 1}@example.invalid`, phone: '', status: 'ACTIVE', created_at: stamp(`${period}-01`, '08:00'), updated_at: now(), face_enrolled: i !== 3, fingerprint_enrolled: false, hourly_rate: 50000 }));
const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(`${today}T12:00:00+07:00`); d.setDate(d.getDate() - i); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); });
let shifts: WorkShift[] = demoEmployees.flatMap(e => dates.map(date => ({ shift_id: `${e.employee_id}-${date}`, employee_id: e.employee_id, date, start_time: '08:00', end_time: '17:00', shift_type: 'OFFICE_HOURS', department: e.department, note: '' })));
let attendance: AttendanceRecord[] = demoEmployees.flatMap((e, index) => dates.flatMap((date, i) => { if (i === 2 && index === 2)
    return []; return (['CHECK_IN', 'CHECK_OUT'] as const).map((type, j) => ({ attendance_id: `${e.employee_id}-${date}-${j}`, id: `${e.employee_id}-${date}-${j}`, employee_id: e.employee_id, employee_name: e.full_name, type, timestamp: stamp(date, j === 0 ? (index === 1 ? '08:30' : '08:00') : (index === 0 ? '18:00' : '17:00')), method: 'FACE' as const, device_id: 'demo-device-1', verification_score: .94, status: 'VALID' as const, punctuality: index === 1 && j === 0 ? 'LATE' as const : 'ON_TIME' as const })); })).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
let adjustments: AttendanceAdjustment[] = [['NV001', 'OVERTIME', 1, 100000, 'PENDING', 0], ['NV002', 'LATE_EARLY', .5, 25000, 'PENDING', 0], ['NV003', 'ABSENCE', 9, 112500, 'PENDING', 2], ['NV001', 'OVERTIME', 1, 100000, 'APPROVED', 1], ['NV002', 'LATE_EARLY', .5, 25000, 'REJECTED', 1]].map(([employee, kind, hours, amount, status, offset], i) => ({ id: `demo-adjustment-${i + 1}`, employee_id: String(employee), employee_name: demoEmployees.find(e => e.employee_id === employee)!.full_name, date: dates[Number(offset)], kind: kind as AttendanceAdjustment['kind'], hours: Number(hours), amount: Number(amount), status: status as AttendanceAdjustment['status'], note: i === 3 ? 'Đã đối chiếu nhật ký vào/ra' : null, reviewed_by: i >= 3 ? 'Quản trị minh họa' : null, reviewed_at: i >= 3 ? now() : null, updated_at: now(), can_review: true, locked: false }));
let policy = { overtime_rate: 100000, late_early_penalty: 50000, absence_penalty_rate: .25, description: 'Chính sách minh họa' };
let payroll: PayrollRecord[] = [];
function recalculate(p: string) { for (const e of demoEmployees) {
    const logs = attendance.filter(a => a.employee_id === e.employee_id && a.timestamp.startsWith(p));
    const workDays = new Set(logs.map(a => a.timestamp.slice(0, 10))).size;
    const approved = adjustments.filter(a => a.employee_id === e.employee_id && a.date.startsWith(p) && a.status === 'APPROVED');
    const ot = approved.filter(a => a.kind === 'OVERTIME').reduce((n, a) => n + a.hours, 0);
    const late = approved.filter(a => a.kind === 'LATE_EARLY').reduce((n, a) => n + a.hours, 0);
    const absence = approved.filter(a => a.kind === 'ABSENCE').reduce((n, a) => n + a.amount, 0);
    const id = `${e.employee_id}-${p}`;
    const old = payroll.find(s => s.payroll_id === id);
    const allowance = old?.allowance ?? 300000;
    const rate = old?.hourly_rate ?? 50000;
    const hours = old?.total_working_hours ?? workDays * 9;
    const next: PayrollRecord = { ...old, payroll_id: id, employee_id: e.employee_id, employee_name: e.full_name, department: e.department, period: p, hourly_rate: rate, total_working_hours: hours, total_overtime: ot, total_late_early: late, total_absence_penalty: absence, allowance, net_salary: Math.max(0, hours * rate + ot * 100000 - late * 50000 - absence + allowance), status: old?.status ?? 'PENDING', overtime_rate: 100000, late_penalty_rate: 50000 };
    payroll = payroll.filter(s => s.payroll_id !== id).concat(next);
} }
recalculate(period);
for (const monthOffset of [1, 2]) {
    const date = new Date(`${period}-01T12:00:00+07:00`);
    date.setMonth(date.getMonth() - monthOffset);
    const p = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
    payroll.push(...demoEmployees.map(e => ({ payroll_id: `${e.employee_id}-${p}`, employee_id: e.employee_id, employee_name: e.full_name, department: e.department, period: p, hourly_rate: 50000, total_working_hours: 180, total_overtime: 2, total_late_early: 0, total_absence_penalty: 0, allowance: 300000, net_salary: 9500000, status: 'PAID' as const, overtime_rate: 100000, late_penalty_rate: 50000 })));
}
let devices: Device[] = ['Pi Sảnh A', 'Pi Cổng B', 'Pi Tầng 2', 'Pi Kho'].map((name, i) => ({ id: `demo-device-${i + 1}`, name, location: ['Sảnh tầng 1', 'Cổng phụ', 'Tầng 2', 'Khu kho'][i], ip: null, status: i < 2 ? 'ONLINE' : i === 2 ? 'OFFLINE' : 'MAINTENANCE', lastSeen: i < 2 ? now() : stamp(dates[1], '17:30'), createdAt: stamp(`${period}-01`, '08:00') }));
const modes = new Map<string, DeviceMode>();
devices.forEach(d => modes.set(d.id, { deviceId: d.id, mode: 'CHECK_IN', confirmed: true, lastUpdated: now() }));
const departments = [{ id: 1, name: 'Vận hành', department_code: 'OPS' }, { id: 2, name: 'Nhân sự', department_code: 'HR' }];
const positions = [{ id: 1, name: 'Trưởng nhóm', department_id: 1, level: 'MANAGER' }, { id: 2, name: 'Chuyên viên', department_id: 1, level: 'EMPLOYEE' }, { id: 3, name: 'Chuyên viên', department_id: 2, level: 'EMPLOYEE' }];
const shiftTemplates:any[]=[];
const demoProfiles=new Map<string,Record<string,any>>();const demoPasswords=new Map<string,string>();
function user() { const role = sessionStorage.getItem('smartface_demo_role'); if (!role)
    return null; const e = demoEmployees[role === 'manager' ? 0 : 1]; return { employee_id: role === 'admin' ? 'DEMO-ADMIN' : e.employee_id, full_name: demoProfiles.get(role)?.display_name || (role === 'admin' ? 'Quản trị minh họa' : e.full_name), avatar:demoProfiles.get(role)?.avatar || '', email: role === 'admin' ? 'admin@example.invalid' : e.email, role_name: role.toUpperCase(), department: role === 'admin' ? 'Quản trị' : e.department, departmentId: 1, positionId: role === 'manager' ? 1 : 2, position: role === 'admin' ? 'Quản trị viên' : e.position }; }
const isAdmin = () => user()?.role_name === 'ADMIN';
const canManage = () => ['ADMIN', 'MANAGER'].includes(user()?.role_name || '');
export async function demoRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    await new Promise(r => setTimeout(r, 180));
    const url = new URL(endpoint, 'http://demo.invalid');
    const path = url.pathname;
    const method = options.method || 'GET';
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    const ok = (data: unknown): ApiResponse<T> => ({ success: true, data: structuredClone(data) as T });
    const fail = (message: string): never => { throw new Error(message); };
    if (path === '/api/auth/me')
        return ok(user());
    if (path === '/api/auth/login') {
        const role = String(body.identifier).replace('demo-', '');
        if (!['admin', 'manager', 'employee'].includes(role) || body.password !== (demoPasswords.get(role)||'demo'))
            return fail('Tài khoản hoặc mật khẩu minh họa không đúng');
        sessionStorage.setItem('smartface_demo_role', role);
        return ok({ user: user() });
    }
    if (path === '/api/auth/solution-inquiries' && method==='POST') return ok({requestId:'DEMO-'+crypto.randomUUID().slice(0,8),createdAt:now()});
    if(path==='/api/auth/profile') {const u=user();if(!u)return fail('Vui lòng đăng nhập');const role=sessionStorage.getItem('smartface_demo_role')!;const previous=demoProfiles.get(role)||{display_name:u.full_name,contact_email:u.email,phone:'',avatar:null};if(method==='PATCH')demoProfiles.set(role,{...previous,...body});return ok({...previous,...demoProfiles.get(role),account:{username:'demo-'+role,role:u.role_name,employee_code:role==='admin'?null:u.employee_id,official_name:role==='admin'?null:demoEmployees.find(e=>e.employee_id===u.employee_id)?.full_name,department:role==='admin'?null:u.department,position:role==='admin'?null:u.position}});}
    if(path==='/api/auth/change-password' && method==='POST'){const role=sessionStorage.getItem('smartface_demo_role');if(!role)return fail('Vui lòng đăng nhập');if(body.current_password!==(demoPasswords.get(role)||'demo'))return fail('Mật khẩu hiện tại không đúng');if(body.new_password.length<8)return fail('Mật khẩu mới cần ít nhất 8 ký tự');demoPasswords.set(role,body.new_password);return ok(null);}
    if (path === '/api/auth/logout') {
        sessionStorage.removeItem('smartface_demo_role');
        return ok(null);
    }
    // Production providers historically load some read queries before authentication; keep demo reads safe.
    const scoped = (employeeId: string) => { const u = user(); return !u || u.role_name === 'ADMIN' || employeeId === u.employee_id || (u.role_name === 'MANAGER' && demoEmployees.find(e => e.employee_id === employeeId)?.department === u.department); };
    if (path === '/api/departments' && method === 'GET')
        return ok(departments);
    if (path === '/api/positions' && method === 'GET')
        return ok(positions);
    if (path === '/api/employees' && method === 'GET')
        return ok(demoEmployees.filter(e => scoped(e.employee_id)));
    if(path.startsWith('/api/employees/') && method==='GET'){const id=decodeURIComponent(path.split('/')[3]);const employee=demoEmployees.find(e=>e.employee_id===id||e.id===id);if(!employee||!scoped(employee.employee_id))return fail('Không tìm thấy hồ sơ trong phạm vi được phép');return ok(employee);}
    if(path==='/api/shifts/templates'){if(!user()||sessionStorage.getItem('smartface_demo_role')==='employee')return fail('Không có quyền truy cập');if(method==='GET')return ok(shiftTemplates);if(method==='POST'){if(!body.name?.trim()||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.start_time)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.end_time)||body.start_time>=body.end_time)return fail('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày');if(shiftTemplates.some(t=>t.name.toLocaleLowerCase('vi-VN')===body.name.trim().toLocaleLowerCase('vi-VN')))return fail('Tên ca đã có. Vui lòng chọn tên khác.');const template={...body,name:body.name.trim(),id:crypto.randomUUID()};shiftTemplates.push(template);return ok(template);}}
    if (path === '/api/shifts' && method === 'GET')
        return ok(shifts.filter(s => scoped(s.employee_id)));
    if (path === '/api/shifts' && method === 'POST') {
        if (!canManage())
            return fail('Bạn không có quyền phân ca');
        const old = shifts.find(s => s.employee_id === body.employeeId && s.date === body.work_date);
        const shift = { ...old, shift_id: old?.shift_id || crypto.randomUUID(), employee_id: body.employeeId, date: body.work_date, start_time: body.start_time, end_time: body.end_time, shift_type: body.shift_type, note: body.note, department: demoEmployees.find(e => e.employee_id === body.employeeId)?.department || '' };
        shifts = shifts.filter(s => s.shift_id !== shift.shift_id).concat(shift);
        return ok(shift);
    }
    const filterDate = (date: string) => { const start = url.searchParams.get('startDate') || url.searchParams.get('date'); const end = url.searchParams.get('endDate') || url.searchParams.get('date'); return (!start || date >= start) && (!end || date <= end); };
    if (path === '/api/attendance' && method === 'GET') {
        let rows = attendance.filter(a => scoped(a.employee_id) && filterDate(a.timestamp.slice(0, 10)) && (!url.searchParams.get('employeeId') || a.employee_id === url.searchParams.get('employeeId')));
        const type = url.searchParams.get('type');
        if (type)
            rows = rows.filter(a => a.type === type);
        const limit = Number(url.searchParams.get('limit')) || 5000;
        const page = Number(url.searchParams.get('page')) || 1;
        return ok(rows.slice((page - 1) * limit, page * limit));
    }
    if (path === '/api/attendance/locks' && method === 'GET')
        return ok([]);
    if (path === '/api/attendance/summaries' && method === 'GET') {
        return ok(shifts.filter(s => scoped(s.employee_id) && filterDate(s.date) && (!url.searchParams.get('employeeId') || s.employee_id === url.searchParams.get('employeeId'))).map(s => { const events = attendance.filter(a => a.employee_id === s.employee_id && a.timestamp.startsWith(s.date)); const first = events.find(a => a.type === 'CHECK_IN'); const last = events.find(a => a.type === 'CHECK_OUT'); const ot = adjustments.filter(a => a.employee_id === s.employee_id && a.date === s.date && a.kind === 'OVERTIME'); const pairs = first && last ? [{ inId: first.id, outId: last.id, start: first.timestamp, end: last.timestamp, counted: true, regular_seconds: 9 * 3600, overtime_seconds: s.employee_id === 'NV001' ? 3600 : 0, credited_regular_seconds: 9 * 3600, credit_reason: 'HALF_SHIFT_REACHED' }] : []; return { id: s.shift_id, employee_id: s.employee_id, employee_uuid: demoEmployees.find(e => e.employee_id === s.employee_id)?.id, date: s.date, regular_hours: pairs.length ? 9 : 0, total_working_hours: pairs.length ? 9 : 0, raw_work_seconds: pairs.length ? 9 * 3600 : 0, late_early: s.employee_id === 'NV002' ? .5 : 0, overtime: ot.filter(a => a.status === 'APPROVED').reduce((n, a) => n + a.hours, 0), approved_overtime_hours: ot.filter(a => a.status === 'APPROVED').reduce((n, a) => n + a.hours, 0), proposed_overtime_hours: ot.reduce((n, a) => n + a.hours, 0), pending_overtime_hours: ot.filter(a => a.status === 'PENDING').reduce((n, a) => n + a.hours, 0), status: pairs.length ? 'PRESENT' : 'ABSENT', first_check_in: first?.timestamp || null, last_check_out: last?.timestamp || null, needs_review: !pairs.length, review_reason: null, policy_version: 'demo', is_legacy_no_policy: false, calculation_details: { pairs, events: events.map(a => ({ id: a.id, type: a.type, time: a.timestamp, status: a.status, method: a.method, device_info: a.device_id })) }, raw_events: events.map(a => ({ id: a.id, time: a.timestamp, type: a.type, method: a.method, device_id: a.device_id, status: a.status })), pairs: [] }; }));
    }
    if (path === '/api/payroll/bonus-penalty') {
        if (method === 'GET')
            return ok(policy);
        if (!isAdmin())
            return fail('Chỉ Admin được sửa chính sách');
        policy = { ...policy, ...body };
        return ok(policy);
    }
    if (path === '/api/payroll' && method === 'GET')
        return ok(payroll.filter(p => scoped(p.employee_id)));
    if (path === '/api/payroll/adjustments' && method === 'GET')
        return ok(adjustments.filter(a => scoped(a.employee_id) && (!url.searchParams.get('period') || a.date.startsWith(url.searchParams.get('period')!)) && (!url.searchParams.get('employeeId') || a.employee_id === url.searchParams.get('employeeId'))).map(a => ({ ...a, can_review: canManage() && (isAdmin() || a.employee_id !== user()?.employee_id) })));
    if (path.startsWith('/api/payroll/adjustments/') && method === 'PATCH') {
        const a = adjustments.find(a => a.id === path.split('/').at(-1));
        if (!a)
            return fail('Khoản không tồn tại');
        if (!canManage() || !scoped(a.employee_id) || (!isAdmin() && a.employee_id === user()?.employee_id))
            return fail('Bạn không được duyệt khoản này');
        if (a.updated_at !== body.updated_at)
            return fail('Khoản đã thay đổi. Vui lòng mở lại để xem dữ liệu mới.');
        Object.assign(a, { status: body.status, note: body.note, reviewed_at: now(), reviewed_by: 'Người duyệt minh họa', updated_at: now() });
        return ok(a);
    }
    if (path === '/api/payroll/generate' && method === 'POST') {
        if (!canManage())
            return fail('Không có quyền tính lương');
        recalculate(body.period);
        return ok(payroll.filter(p => p.period === body.period && scoped(p.employee_id)));
    }
    if (path.startsWith('/api/payroll/period/')) {
        const parts = path.split('/');
        const p = parts[4];
        if (!canManage())
            return fail('Không có quyền');
        if (parts[5] === 'finalize') {
            if (adjustments.some(a => a.date.startsWith(p) && a.status === 'PENDING'))
                return fail('Còn khoản chờ duyệt. Hoàn tất xét duyệt trước khi chốt kỳ.');
            payroll.filter(s => s.period === p && scoped(s.employee_id)).forEach(s => s.status = 'FINALIZED');
        }
        else if (parts[5] === 'unlock') {
            if (!isAdmin())
                return fail('Chỉ Admin được mở khóa');
            payroll.filter(s => s.period === p).forEach(s => s.status = 'PENDING');
        }
        return ok(payroll.filter(s => s.period === p && scoped(s.employee_id)));
    }
    if (path.startsWith('/api/payroll/') && method === 'PUT') {
        const p = payroll.find(p => p.payroll_id === path.split('/').at(-1));
        if (!p || !canManage() || !scoped(p.employee_id) || (!isAdmin() && p.employee_id === user()?.employee_id))
            return fail('Không có quyền chỉnh phiếu');
        if (p.status !== 'PENDING')
            return fail('Phiếu đã khóa');
        Object.assign(p, body);
        p.net_salary = Math.max(0, Number(p.total_working_hours ?? 0) * p.hourly_rate + calcPayrollAmount(p.total_overtime, p.overtime_rate ?? 100000, p.hourly_rate) - calcPayrollAmount(p.total_late_early, p.late_penalty_rate ?? 50000, p.hourly_rate) - (p.total_absence_penalty || 0) + p.allowance);
        return ok(p);
    }
    if (path === '/api/devices') {
        if (!canManage())
            return fail('Không có quyền quản lý thiết bị');
        if (method === 'GET')
            return ok(devices);
        if (method === 'POST') {
            const d: Device = { id: crypto.randomUUID(), name: body.name, location: body.location, ip: body.ip || null, status: body.status || 'OFFLINE', lastSeen: null, createdAt: now() };
            devices.unshift(d);
            return ok(d);
        }
    }
    if (path.startsWith('/api/devices/')) {
        if (!canManage())
            return fail('Không có quyền quản lý thiết bị');
        const id = path.split('/')[3];
        const d = devices.find(d => d.id === id);
        if (!d)
            return fail('Không tìm thấy bản ghi thiết bị');
        if (path.endsWith('/mode')) {
            if (method === 'PATCH') {
                modes.set(id, { deviceId: id, mode: body.mode, confirmed: false });
                return ok(modes.get(id));
            }
            return ok(modes.get(id) || { deviceId: id, mode: null, confirmed: false });
        }
        if (method === 'GET')
            return ok(d);
        if (method === 'PUT') {
            Object.assign(d, body);
            return ok(d);
        }
        if (method === 'DELETE') {
            if (!isAdmin())
                return fail('Chỉ Admin được xóa thiết bị');
            devices = devices.filter(x => x.id !== id);
            return ok(null);
        }
    }
    if (path.startsWith('/api/biometrics/') && method === 'GET')
        return ok({ employeeId: path.split('/')[3], sampleCount: 0, samples: [] });
    return fail(`Bản minh họa chưa mô phỏng thao tác ${method} ${path}. Kết nối backend để sử dụng luồng này.`);
}
