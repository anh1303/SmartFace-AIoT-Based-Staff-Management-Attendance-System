import { prisma } from '../src/config/database.js';

async function main() {
  const emps = await prisma.employee.findMany({
    select: { id: true, employee_code: true, full_name: true, createdAt: true, status: true, hourly_rate: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('Total employees:', emps.length);
  for (const e of emps) {
    const vnDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(e.createdAt);
    console.log(`${e.employee_code} | ${e.full_name} | created: ${e.createdAt.toISOString()} | VN: ${vnDate} | status: ${e.status}`);
  }

  const shiftsCount = await prisma.employee_shifts.count();
  const logsCount = await prisma.attendance_logs.count();
  const summariesCount = await prisma.daily_attendance_summary.count();
  const reviewGroups = await prisma.daily_attendance_summary.groupBy({
    by: ['review_status'],
    _count: true,
  });
  const pendingAdjs = await prisma.attendanceAdjustment.findMany({
    where: { status: 'PENDING' },
    select: { id: true, employee_id: true, work_date: true, kind: true, hours: true, amount: true, status: true },
    take: 10,
  });
  console.log('Pending adjustments count:', await prisma.attendanceAdjustment.count({ where: { status: 'PENDING' } }));
  console.log('Sample pending adjustments:', pendingAdjs);
  const totalAdjs = await prisma.attendanceAdjustment.groupBy({
    by: ['status'],
    _count: true,
  });
  console.log('Adjustment status groups:', totalAdjs);

  const snapshotCounts: any = await prisma.$queryRaw`
    SELECT 
      count(*) filter (where pre_approval_snapshot is null) as null_count,
      count(*) filter (where pre_approval_snapshot is not null) as not_null_count,
      count(*) as total
    FROM daily_attendance_summary 
    WHERE review_status = 'APPROVED'
  `;
  console.log('Snapshot stats for APPROVED days:', snapshotCounts);
}

main().finally(() => prisma.$disconnect());
