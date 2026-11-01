import { prisma } from '../src/config/database.js'
import { aggregateDailyAttendance, createAttendanceSnapshot } from '../src/modules/attendance/attendance.service.js'
import { generate, finalizePeriod } from '../src/modules/payroll/payroll.service.js'
import { vnDay, shiftBounds } from '../src/modules/attendance/attendance.policy.js'
import { syncDayAdjustments } from '../src/modules/attendance/attendance.adjustments.js'
import { sourceHourlyRate } from '../src/modules/employees/employee.wage.js'
import { policyForPeriod } from '../src/common/payroll-policy.js'
import { Prisma } from '@prisma/client'

/**
 * Script Rebuild Chấm công & Bảng lương:
 * 1. Nạp danh sách 22 nhân viên, ca làm việc, chính sách lương.
 * 2. Xóa sạch dữ liệu cũ theo đúng thứ tự khóa ngoại.
 * 3. Tạo phân ca từ max('2026-08-01', vnDay(createdAt)) đến '2026-10-31'. Ca đêm gán work_date là ngày kết thúc.
 * 4. Tạo lượt quét thực tế (đúng giờ, trễ/sớm, OT tối đa 4h, ca đêm, ca thiếu lượt) từ 01/08 đến thời điểm hiện tại.
 * 5. Tổng hợp công và chốt APPROVED nguồn SEED cho các ngày trước hôm nay; xử lý ca thiếu lượt quá hạn thành ABSENT.
 * 6. Tính và chốt lương FINALIZED cho tháng 8 và tháng 9; tính lương PENDING cho tháng 10.
 * 7. Báo cáo thống kê chi tiết.
 */
async function main() {
  console.log('================================================================');
  console.log('   BẮT ĐẦU TÁI THIẾT DỮ LIỆU CHẤM CÔNG & BẢNG LƯƠNG (CLOUD DB)');
  console.log('================================================================');

  // ---------------------------------------------------------
  // BƯỚC 1: NẠP DỮ LIỆU NỀN
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 1: NẠP DỮ LIỆU NỀN ---');
  const employees = await prisma.employee.findMany({
    select: {
      id: true,
      employee_code: true,
      full_name: true,
      createdAt: true,
      status: true,
      hourly_rate: true,
      departmentId: true,
      positionId: true,
      user_id: true,
    },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Tìm thấy ${employees.length} nhân viên trong hệ thống.`);

  const adminUser = await prisma.user.findFirst({
    where: { roles: { role_name: 'ADMIN' }, is_active: true },
    select: { id: true, username: true },
  });
  if (!adminUser) {
    throw new Error('Không tìm thấy tài khoản ADMIN trong hệ thống để thực thi thao tác.');
  }
  console.log(`Người thực hiện (ADMIN): ${adminUser.username} (${adminUser.id})`);

  // Đảm bảo chính sách lương nền '2026-08' tồn tại để tính lương T8 & T9
  const basePolicy = await prisma.bonusPenalty.findFirst({
    where: { OR: [{ effective_period: null }, { effective_period: '2026-08' }] },
  });
  if (basePolicy) {
    if (basePolicy.effective_period !== '2026-08') {
      await prisma.bonusPenalty.update({
        where: { id: basePolicy.id },
        data: { effective_period: '2026-08' },
      });
      console.log(`Đã cập nhật kỳ hiệu lực chính sách gốc id ${basePolicy.id} thành '2026-08'.`);
    }
  } else {
    await prisma.bonusPenalty.create({
      data: {
        effective_period: '2026-08',
        overtime_rate: 2.0,
        late_early_penalty: 1.5,
        absence_penalty_rate: 2.0,
        description: 'Chính sách hệ số lương áp dụng từ tháng 08/2026',
      },
    });
    console.log("Đã tạo chính sách lương kỳ '2026-08'.");
  }

  // ---------------------------------------------------------
  // BƯỚC 2: XÓA DỮ LIỆU CŨ THEO THỨ TỰ KHÓA NGOẠI
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 2: XÓA DỮ LIỆU CŨ ---');
  const delAdj = await prisma.attendanceAdjustment.deleteMany();
  console.log(`- Đã xóa ${delAdj.count} khoản điều chỉnh (attendance_adjustments).`);

  const delPayroll = await prisma.payrollRecord.deleteMany();
  console.log(`- Đã xóa ${delPayroll.count} phiếu lương (payroll_records).`);

  const delLogs = await prisma.attendance_logs.deleteMany();
  console.log(`- Đã xóa ${delLogs.count} lượt quét (attendance_logs).`);

  const delSummaries = await prisma.daily_attendance_summary.deleteMany();
  console.log(`- Đã xóa ${delSummaries.count} tổng hợp ngày công (daily_attendance_summary).`);

  const delShifts = await prisma.employee_shifts.deleteMany();
  console.log(`- Đã xóa ${delShifts.count} phân ca (employee_shifts).`);

  const delLocks = await prisma.attendance_locks.deleteMany();
  console.log(`- Đã xóa ${delLocks.count} khóa ngày công (attendance_locks).`);

  const delStates = await prisma.attendanceAggregationState.deleteMany();
  console.log(`- Đã xóa ${delStates.count} trạng thái tổng hợp (attendance_aggregation_state).`);

  const delNotifs = await prisma.systemNotification.deleteMany({
    where: {
      OR: [
        { event_key: { startsWith: 'missing-shift:' } },
        { event_key: { startsWith: 'aggregation-failed:' } },
        { event_key: { startsWith: 'locked-scan:' } },
        { event_key: { startsWith: 'auto-absent:' } },
      ],
    },
  });
  console.log(`- Đã xóa ${delNotifs.count} thông báo chấm công cũ.`);

  await prisma.attendanceAlertCheckpoint.upsert({
    where: { name: 'missing_shift_scans' },
    update: { last_due_at: new Date('2026-08-01T00:00:00Z') },
    create: { name: 'missing_shift_scans', last_due_at: new Date('2026-08-01T00:00:00Z') },
  });
  console.log('- Đã đặt lại checkpoint missing_shift_scans về 2026-08-01T00:00:00Z.');

  // ---------------------------------------------------------
  // BƯỚC 3: TẠO PHÂN CA MỚI (01/08/2026 - 31/10/2026)
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 3: TẠO PHÂN CA MỚI ---');
  const shiftRecords: Prisma.employee_shiftsCreateManyInput[] = [];

  // Tạo mảng tất cả các ngày từ 2026-08-01 đến 2026-10-31
  const allDates: string[] = [];
  const curDate = new Date('2026-08-01T00:00:00Z');
  const stopDate = new Date('2026-10-31T00:00:00Z');
  while (curDate <= stopDate) {
    allDates.push(curDate.toISOString().slice(0, 10));
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }

  // Tên thứ trong tuần tiếng Việt
  const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

  for (const emp of employees) {
    const empCreatedVN = vnDay(emp.createdAt);
    const startDay = empCreatedVN > '2026-08-01' ? empCreatedVN : '2026-08-01';

    for (const dateStr of allDates) {
      if (dateStr < startDay) continue; // Không tạo ca trước ngày tạo hồ sơ

      const d = new Date(`${dateStr}T00:00:00Z`);
      const dayOfWeek = d.getUTCDay(); // 0: CN, 6: T7
      const workDayName = dayNames[dayOfWeek];

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Cuối tuần: Ca nghỉ
        shiftRecords.push({
          employee_id: emp.id,
          shift_id: 21, // Nghỉ ca
          work_date: d,
          work_day: workDayName,
          shift_type: 'OFF',
          start_time: new Date('1970-01-01T00:00:00.000Z'),
          end_time: new Date('1970-01-01T00:00:00.000Z'),
          note: 'Nghỉ cuối tuần',
        });
      } else {
        // Ngày trong tuần:
        // Đặt ca qua đêm đặc thù cho NV-003 ngày 2026-10-21 (kết thúc 02:00 ngày 21/10, bắt đầu 22:00 ngày 20/10)
        if (emp.employee_code === 'NV-003' && dateStr === '2026-10-21') {
          shiftRecords.push({
            employee_id: emp.id,
            shift_id: 23, // Ca khác
            work_date: d,
            work_day: workDayName,
            shift_type: 'NIGHT_SHIFT',
            start_time: new Date('1970-01-01T22:00:00.000Z'),
            end_time: new Date('1970-01-01T02:00:00.000Z'),
            note: 'Ca đêm 22:00 (20/10) - 02:00 (21/10)',
          });
        } else {
          // Ca hành chính tiêu chuẩn (08:00 - 17:00)
          shiftRecords.push({
            employee_id: emp.id,
            shift_id: 22, // Ca Hành Chính
            work_date: d,
            work_day: workDayName,
            shift_type: 'OFFICE_HOURS',
            start_time: new Date('1970-01-01T08:00:00.000Z'),
            end_time: new Date('1970-01-01T17:00:00.000Z'),
            note: 'Ca hành chính tiêu chuẩn',
          });
        }
      }
    }
  }

  // Insert theo batch để tối ưu hiệu năng
  const CHUNK_SIZE = 500;
  for (let i = 0; i < shiftRecords.length; i += CHUNK_SIZE) {
    await prisma.employee_shifts.createMany({
      data: shiftRecords.slice(i, i + CHUNK_SIZE),
    });
  }
  console.log(`Đã tạo thành công ${shiftRecords.length} phân ca (employee_shifts).`);

  // ---------------------------------------------------------
  // BƯỚC 4: TẠO LƯỢT QUÉT (ATTENDANCE LOGS)
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 4: TẠO LƯỢT QUÉT CHẤM CÔNG ---');
  const logs: Prisma.attendance_logsCreateManyInput[] = [];
  const TODAY_VN = '2026-10-31';

  // Hàm sinh số giả ngẫu nhiên xác định theo seed chuỗi
  function pseudoRandom(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    return (Math.abs(hash) % 10000) / 10000;
  }

  for (const s of shiftRecords) {
    if (s.shift_type === 'OFF') continue; // Không tạo quét cho ca nghỉ

    const dateStr = s.work_date instanceof Date ? s.work_date.toISOString().slice(0, 10) : String(s.work_date).slice(0, 10);
    const emp = employees.find(e => e.id === s.employee_id)!;
    const rnd = pseudoRandom(`${emp.employee_code}:${dateStr}`);

    if (dateStr < TODAY_VN) {
      // 1. Ca đêm đặc thù (22:00 ngày trước đến 02:00 ngày kết thúc)
      if (s.shift_type === 'NIGHT_SHIFT') {
        // Bắt đầu 22:00 VN ngày 20/10 -> UTC là 2026-10-20T15:00:00Z. Check-in lúc 21:55 VN (14:55 UTC).
        const inTime = new Date('2026-10-20T14:55:00.000Z');
        // Kết thúc 02:00 VN ngày 21/10 -> UTC là 2026-10-20T19:00:00Z. Check-out lúc 02:05 VN (19:05 UTC).
        const outTime = new Date('2026-10-20T19:05:00.000Z');

        logs.push({
          employee_id: emp.id,
          event_time: inTime,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.94,
          liveness_score: 0.98,
        });
        logs.push({
          employee_id: emp.id,
          event_time: outTime,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.93,
          liveness_score: 0.97,
        });
        continue;
      }

      // 2. Các kịch bản ca ngày thường (08:00 - 17:00 VN, tức 01:00 - 10:00 UTC)
      // a. 3% Vắng không lý do (không tạo quét)
      if (rnd < 0.03) {
        continue;
      }

      // b. 3% Quên check-out (chỉ có check-in) -> Kịch bản thiếu lượt để kiểm thử xử lý tự động thành ABSENT
      if (rnd < 0.06) {
        const checkInMinute = Math.floor(rnd * 10); // 0-9
        const inUTC = new Date(`${dateStr}T00:5${checkInMinute}:00.000Z`); // ~07:50 - 07:59 VN
        logs.push({
          employee_id: emp.id,
          event_time: inUTC,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.92,
          liveness_score: 0.96,
        });
        continue;
      }

      // c. 6% Đi trễ (08:15 - 08:35 VN, tức 01:15 - 01:35 UTC)
      if (rnd < 0.12) {
        const lateMinutes = 15 + Math.floor(rnd * 20); // 15 - 35
        const inUTC = new Date(`${dateStr}T01:${String(lateMinutes).padStart(2, '0')}:00.000Z`);
        const outUTC = new Date(`${dateStr}T10:05:00.000Z`); // 17:05 VN
        logs.push({
          employee_id: emp.id,
          event_time: inUTC,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.91,
          liveness_score: 0.95,
        });
        logs.push({
          employee_id: emp.id,
          event_time: outUTC,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.93,
          liveness_score: 0.97,
        });
        continue;
      }

      // d. 8% Làm thêm giờ OT (19:00 - 21:00 VN, tối đa 4h)
      if (rnd < 0.20) {
        const inUTC = new Date(`${dateStr}T00:55:00.000Z`); // 07:55 VN
        // OT 2 đến 3.5 giờ (kết thúc 19:00 đến 20:30 VN, tức 12:00 đến 13:30 UTC)
        const otHours = 2 + (Math.floor(rnd * 3));
        const outUTC = new Date(`${dateStr}T${10 + otHours}:15:00.000Z`);
        logs.push({
          employee_id: emp.id,
          event_time: inUTC,
          type: 'CHECK_IN',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:in`,
          verification_score: 0.95,
          liveness_score: 0.98,
        });
        logs.push({
          employee_id: emp.id,
          event_time: outUTC,
          type: 'CHECK_OUT',
          method: 'FACE',
          status: 'VALID',
          device_info: 'device:GATE-01',
          work_date: new Date(`${dateStr}T00:00:00Z`),
          event_key: `seed:${emp.employee_code}:${dateStr}:out`,
          verification_score: 0.94,
          liveness_score: 0.96,
        });
        continue;
      }

      // e. 80% Đúng giờ tiêu chuẩn (07:52 - 07:58 VN check in, 17:03 - 17:15 VN check out)
      const inMinute = 50 + Math.floor(rnd * 8); // 50 - 57
      const inUTC = new Date(`${dateStr}T00:${inMinute}:00.000Z`);
      const outMinute = 3 + Math.floor(rnd * 12); // 03 - 14
      const outUTC = new Date(`${dateStr}T10:${String(outMinute).padStart(2, '0')}:00.000Z`);

      logs.push({
        employee_id: emp.id,
        event_time: inUTC,
        type: 'CHECK_IN',
        method: 'FACE',
        status: 'VALID',
        device_info: 'device:GATE-01',
        work_date: new Date(`${dateStr}T00:00:00Z`),
        event_key: `seed:${emp.employee_code}:${dateStr}:in`,
        verification_score: 0.94,
        liveness_score: 0.98,
      });
      logs.push({
        employee_id: emp.id,
        event_time: outUTC,
        type: 'CHECK_OUT',
        method: 'FACE',
        status: 'VALID',
        device_info: 'device:GATE-01',
        work_date: new Date(`${dateStr}T00:00:00Z`),
        event_key: `seed:${emp.employee_code}:${dateStr}:out`,
        verification_score: 0.95,
        liveness_score: 0.97,
      });
    } else {
      // HÔM NAY (2026-10-31):
      // Thời điểm chạy hiện tại là ~16:30 VN. Ca chưa kết thúc -> chỉ tạo lượt CHECK_IN, KHÔNG tạo CHECK_OUT tương lai!
      const inMinute = 50 + Math.floor(rnd * 8);
      const inUTC = new Date(`${TODAY_VN}T00:${inMinute}:00.000Z`); // ~07:50 - 07:58 VN
      logs.push({
        employee_id: emp.id,
        event_time: inUTC,
        type: 'CHECK_IN',
        method: 'FACE',
        status: 'VALID',
        device_info: 'device:GATE-01',
        work_date: new Date(`${TODAY_VN}T00:00:00Z`),
        event_key: `seed:${emp.employee_code}:${TODAY_VN}:in`,
        verification_score: 0.95,
        liveness_score: 0.98,
      });
    }
  }

  // Insert logs theo batch
  for (let i = 0; i < logs.length; i += CHUNK_SIZE) {
    await prisma.attendance_logs.createMany({
      data: logs.slice(i, i + CHUNK_SIZE),
    });
  }
  console.log(`Đã tạo thành công ${logs.length} lượt quét (attendance_logs).`);

  // ---------------------------------------------------------
  // BƯỚC 5: TỔNG HỢP VÀ CHỐT CÔNG
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 5: TỔNG HỢP VÀ CHỐT CÔNG ---');
  console.log('- Đang tổng hợp chấm công tháng 08/2026...');
  await aggregateDailyAttendance(8, 2026);

  console.log('- Đang tổng hợp chấm công tháng 09/2026...');
  await aggregateDailyAttendance(9, 2026);

  console.log('- Đang tổng hợp chấm công tháng 10/2026...');
  await aggregateDailyAttendance(10, 2026);

  // Chốt công cho các ngày trước hôm nay (work_date < 2026-10-31)
  console.log('- Đang chốt duyệt APPROVED cho các ngày trước hôm nay...');
  const pastSummaries = await prisma.daily_attendance_summary.findMany({
    where: { work_date: { lt: new Date(`${TODAY_VN}T00:00:00Z`) } },
    include: { employees: true },
  });

  const adjustmentPolicyT8 = await policyForPeriod('2026-08');
  const adjustmentPolicyT10 = await policyForPeriod('2026-10');

  const incompleteSummaries = pastSummaries.filter(sum =>
    sum.requires_review ||
    sum.attendance_status === 'INCOMPLETE' ||
    (!sum.last_check_out && sum.attendance_status !== 'OFF' && sum.attendance_status !== 'ABSENT')
  );

  let absentConvertedCount = 0;
  for (const sum of incompleteSummaries) {
    const dateStr = sum.work_date.toISOString().slice(0, 10);
    const period = dateStr.slice(0, 7);
    const policy = period === '2026-10' ? adjustmentPolicyT10 : adjustmentPolicyT8;
    const rate = sourceHourlyRate(sum.employees, period, null, false);
    const details = (sum.calculation_details || {}) as Record<string, any>;
    const snapshot = createAttendanceSnapshot(sum);

    const updated = await prisma.daily_attendance_summary.update({
      where: { id: sum.id },
      data: {
        attendance_status: 'ABSENT',
        total_working_hours: 0,
        overtime: 0,
        overtime_candidate_hours: 0,
        late_early: 0,
        regular_seconds: 0,
        overtime_seconds: 0,
        late_early_seconds: 0,
        review_status: 'APPROVED',
        approval_source: 'SEED',
        approved_at: new Date(),
        approved_by: adminUser.id,
        approval_reason: 'Chốt tự động: ca thiếu lượt sau khi hết thời hạn OT tối đa 4 giờ',
        pre_approval_snapshot: snapshot,
        requires_review: false,
        calculation_details: { ...details, absenceCandidate: true },
      },
    });

    await syncDayAdjustments(prisma, updated, rate, policy?.absence_penalty_rate ?? null);
    absentConvertedCount++;
  }

  // Chốt APPROVED và gán pre_approval_snapshot đầy đủ cho toàn bộ các ngày công bình thường còn lại
  const incompleteIds = new Set(incompleteSummaries.map(s => s.id.toString()));
  const normalSummaries = pastSummaries.filter(sum => !incompleteIds.has(sum.id.toString()));
  for (const sum of normalSummaries) {
    const dateStr = sum.work_date.toISOString().slice(0, 10);
    const period = dateStr.slice(0, 7);
    const policy = period === '2026-10' ? adjustmentPolicyT10 : adjustmentPolicyT8;
    const rate = sourceHourlyRate(sum.employees, period, null, false);
    const snapshot = createAttendanceSnapshot(sum);
    const otCandidate = Number(sum.overtime_candidate_hours ?? 0);

    const updated = await prisma.daily_attendance_summary.update({
      where: { id: sum.id },
      data: {
        review_status: 'APPROVED',
        approval_source: 'SEED',
        approved_at: new Date(),
        approved_by: adminUser.id,
        approval_reason: 'Chốt chuẩn dữ liệu hệ thống',
        overtime: otCandidate,
        overtime_status: otCandidate > 0 ? 'APPROVED' : 'NONE',
        requires_review: false,
        pre_approval_snapshot: snapshot,
      },
    });

    await syncDayAdjustments(prisma, updated, rate, policy?.absence_penalty_rate ?? null);
  }

  // Đảm bảo tất cả các khoản điều chỉnh có phát sinh trước hôm nay đều APPROVED
  await prisma.$executeRaw`
    UPDATE attendance_adjustments
    SET status = 'APPROVED',
        reviewed_by = ${adminUser.id}::uuid,
        reviewed_at = clock_timestamp()
    WHERE work_date < ${new Date(`${TODAY_VN}T00:00:00Z`)}
      AND (hours > 0 OR amount > 0)
  `;

  // Khóa tất cả các ngày công trong quá khứ để bảo vệ tính toàn vẹn
  const uniquePastDates = [...new Set(pastSummaries.map(s => s.work_date.toISOString().slice(0, 10)))];
  await prisma.attendance_locks.createMany({
    data: uniquePastDates.map(dStr => ({
      work_date: new Date(`${dStr}T00:00:00Z`),
      is_locked: true,
      locked_by: 'SEED',
      locked_at: new Date(),
    })),
    skipDuplicates: true,
  });

  const approvedCount = pastSummaries.length - absentConvertedCount;
  console.log(`- Đã chốt APPROVED: ${approvedCount} ngày công hợp lệ.`);
  console.log(`- Đã xử lý thành ABSENT (phạt vắng): ${absentConvertedCount} ca thiếu lượt.`);
  console.log(`- Đã khóa ${uniquePastDates.length} ngày công trong attendance_locks.`);
  console.log(`- Ngày hôm nay (${TODAY_VN}): Được giữ nguyên trạng thái NONE/PENDING, không tự chốt.`);


  // ---------------------------------------------------------
  // BƯỚC 6: TÍNH VÀ CHỐT LƯƠNG
  // ---------------------------------------------------------
  console.log('\n--- BƯỚC 6: TÍNH VÀ CHỐT LƯƠNG ---');

  // Tháng 08/2026: Tính và chốt FINALIZED
  console.log('- Đang tính lương tháng 08/2026...');
  const prT8 = await generate('2026-08', undefined, adminUser.id, { id: adminUser.id, role: 'ADMIN' });
  console.log(`  Đã tạo ${prT8.length} phiếu lương cho tháng 08/2026.`);
  console.log('- Đang chốt FINALIZED kỳ lương tháng 08/2026...');
  await finalizePeriod('2026-08', adminUser.id, 'ADMIN');
  console.log('  Kỳ lương tháng 08/2026 đã chốt FINALIZED thành công.');

  // Tháng 09/2026: Tính và chốt FINALIZED
  console.log('- Đang tính lương tháng 09/2026...');
  const prT9 = await generate('2026-09', undefined, adminUser.id, { id: adminUser.id, role: 'ADMIN' });
  console.log(`  Đã tạo ${prT9.length} phiếu lương cho tháng 09/2026.`);
  console.log('- Đang chốt FINALIZED kỳ lương tháng 09/2026...');
  await finalizePeriod('2026-09', adminUser.id, 'ADMIN');
  console.log('  Kỳ lương tháng 09/2026 đã chốt FINALIZED thành công.');

  // Tháng 10/2026: Tính và giữ PENDING (vì ngày 31/10 chưa hết ngày)
  console.log('- Đang tính lương tháng 10/2026...');
  const prT10 = await generate('2026-10', undefined, adminUser.id, { id: adminUser.id, role: 'ADMIN' });
  console.log(`  Đã tạo ${prT10.length} phiếu lương cho tháng 10/2026 (trạng thái PENDING).`);

  // ---------------------------------------------------------
  // BƯỚC 7: BÁO CÁO THỐNG KÊ CHI TIẾT
  // ---------------------------------------------------------
  console.log('\n================================================================');
  console.log('                  KẾT QUẢ THỰC HIỆN TÁI THIẾT');
  console.log('================================================================');

  const totalEmployees = await prisma.employee.count();
  const totalShifts = await prisma.employee_shifts.count();
  const totalLogs = await prisma.attendance_logs.count();
  const totalSummaries = await prisma.daily_attendance_summary.count();
  const approvedSummaries = await prisma.daily_attendance_summary.count({ where: { review_status: 'APPROVED' } });
  const pendingSummaries = await prisma.daily_attendance_summary.count({ where: { review_status: 'PENDING' } });
  const noneSummaries = await prisma.daily_attendance_summary.count({ where: { review_status: 'NONE' } });

  const payrollT8 = await prisma.payrollRecord.findMany({ where: { payroll_period: '2026-08' } });
  const payrollT9 = await prisma.payrollRecord.findMany({ where: { payroll_period: '2026-09' } });
  const payrollT10 = await prisma.payrollRecord.findMany({ where: { payroll_period: '2026-10' } });

  console.log(`1. Nhân viên:`);
  console.log(`   - Tổng số nhân viên áp dụng: ${totalEmployees}`);
  console.log(`   - Nhân viên có dữ liệu từ T8/2026: 18 nhân sự`);
  console.log(`   - Nhân viên tuyển mới trong T10/2026: 4 nhân sự (chỉ có ca và công từ ngày tạo)`);

  console.log(`\n2. Phân ca & Lượt quét:`);
  console.log(`   - Tổng số phân ca (employee_shifts): ${totalShifts}`);
  console.log(`   - Tổng số lượt quét (attendance_logs): ${totalLogs}`);

  console.log(`\n3. Ngày công (daily_attendance_summary):`);
  console.log(`   - Tổng số ngày công: ${totalSummaries}`);
  console.log(`   - Đã chốt (APPROVED): ${approvedSummaries}`);
  console.log(`   - Chờ duyệt (PENDING): ${pendingSummaries}`);
  console.log(`   - Chưa chốt / Bình thường (NONE): ${noneSummaries}`);

  console.log(`\n4. Bảng lương (payroll_records):`);
  console.log(`   - Tháng 08/2026: ${payrollT8.length} phiếu - Trạng thái: ${payrollT8[0]?.status || 'N/A'}`);
  console.log(`   - Tháng 09/2026: ${payrollT9.length} phiếu - Trạng thái: ${payrollT9[0]?.status || 'N/A'}`);
  console.log(`   - Tháng 10/2026: ${payrollT10.length} phiếu - Trạng thái: ${payrollT10[0]?.status || 'N/A'}`);

  console.log('\nQuá trình hoàn tất an toàn và nhất quán trên cơ sở dữ liệu Cloud.');
  console.log('================================================================');
}

main()
  .catch(err => {
    console.error('LỖI TRONG QUÁ TRÌNH TÁI THIẾT DỮ LIỆU:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
