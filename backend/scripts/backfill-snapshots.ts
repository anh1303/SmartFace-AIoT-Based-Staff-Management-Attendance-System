import { prisma } from '../src/config/database.js'

/**
 * Script đối chiếu kiểm toán (Read-Only Audit):
 * Thống kê chính xác số lượng ngày công APPROVED có và không có pre_approval_snapshot.
 * Tuyệt đối KHÔNG ghi đè dữ liệu hiện tại vào pre_approval_snapshot để tránh làm sai lệch ngữ nghĩa hoàn tác.
 */
async function main() {
  console.log('================================================================')
  console.log('   BÁO CÁO ĐỐI CHIẾU PRE_APPROVAL_SNAPSHOT TRÊN CLOUD DATABASE   ')
  console.log('================================================================')

  const totalSummaries = await prisma.daily_attendance_summary.count()
  const stats: any = await prisma.$queryRaw`
    SELECT 
      count(*) filter (where review_status = 'APPROVED') as approved_total,
      count(*) filter (where review_status = 'APPROVED' and pre_approval_snapshot->'reconstructed' = 'true'::jsonb) as approved_reconstructed,
      count(*) filter (where review_status = 'APPROVED' and pre_approval_snapshot is not null
        and pre_approval_snapshot->'reconstructed' is distinct from 'true'::jsonb
        and jsonb_typeof(pre_approval_snapshot) = 'object'
        and pre_approval_snapshot ?& array['total_working_hours', 'late_early', 'overtime', 'regular_seconds', 'overtime_seconds', 'late_early_seconds', 'attendance_status', 'review_status', 'requires_review', 'review_reason', 'overtime_status', 'overtime_candidate_hours', 'manual_adjustment', 'calculation_details']) as approved_complete_fields,
      count(*) filter (where review_status = 'APPROVED' and pre_approval_snapshot is not null
        and pre_approval_snapshot->'reconstructed' is distinct from 'true'::jsonb
        and (jsonb_typeof(pre_approval_snapshot) is distinct from 'object'
          or not (pre_approval_snapshot ?& array['total_working_hours', 'late_early', 'overtime', 'regular_seconds', 'overtime_seconds', 'late_early_seconds', 'attendance_status', 'review_status', 'requires_review', 'review_reason', 'overtime_status', 'overtime_candidate_hours', 'manual_adjustment', 'calculation_details']))) as approved_incomplete_fields,
      count(*) filter (where review_status = 'APPROVED' and pre_approval_snapshot is null) as approved_without_snapshot,
      count(*) filter (where review_status = 'PENDING') as pending_total,
      count(*) filter (where review_status = 'NONE') as none_total
    FROM daily_attendance_summary
  `
  const s = stats[0]

  console.log(`\n1. Tổng số bản ghi ngày công: ${totalSummaries}`)
  console.log(`2. Trạng thái phân bổ:`)
  console.log(`   - APPROVED: ${s.approved_total} ngày`)
  console.log(`     + Snapshot có đủ trường: ${s.approved_complete_fields} ngày`)
  console.log(`     + Snapshot thiếu trường hoặc sai cấu trúc: ${s.approved_incomplete_fields} ngày`)
  console.log(`     + Snapshot đánh dấu dựng lại: ${s.approved_reconstructed} ngày`)
  console.log(`     + Không có snapshot: ${s.approved_without_snapshot} ngày (Hệ thống tính lại từ dữ liệu quét gốc và phân ca khi mở khóa)`)
  console.log(`   - PENDING (chờ duyệt): ${s.pending_total} ngày`)
  console.log(`   - NONE (bình thường): ${s.none_total} ngày`)
  console.log('\nNguyên tắc hệ thống:')
  console.log('• Đủ trường không chứng minh snapshot phản ánh chính xác trạng thái trước chốt.')
  console.log('• Không ghi trạng thái post-approval vào pre_approval_snapshot.')
  console.log('• Bản ghi thiếu snapshot khi mở khóa sẽ được tính lại từ attendance_logs và employee_shifts,')
  console.log('  đồng thời ghi rõ nguồn: "Mở khóa: tính lại từ dữ liệu quét gốc".')
  console.log('================================================================')
}

main()
  .catch(err => {
    console.error('Lỗi khi chạy đối chiếu:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
