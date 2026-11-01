# Sửa chuyển đổi hệ số lương và đối soát database

## Phạm vi và nguyên tắc

Chính sách mới dùng OT 2x, trễ/sớm 1.5x, vắng 2x theo lương giờ. Ba hệ số nhận từ 0 đến 50, tối đa bốn chữ số thập phân. `bonus_penalty.effective_period` xác định tháng bắt đầu áp dụng; phiên bản đã lưu không sửa/xóa. API tạo phiên bản từ tháng kế tiếp và từ chối trùng tháng. Phiên bản tương lai vẫn hiển thị kỳ hiệu lực trên giao diện.

`policyForPeriod()` chọn phiên bản gần nhất không sau kỳ đang tính. DB hoàn toàn chưa cấu hình dùng cùng một bộ mặc định cho chấm công và lương. Khi đã có cấu hình nhưng thiếu lịch sử cho kỳ cũ, trả về chưa xác định, không dùng chính sách tháng sau. Khi cấu hình lần đầu qua API, lưu thêm mặc định của tháng hiện tại để việc lên lịch tháng sau không làm mất chính sách tháng này.

Khoản vắng đã có snapshot tiếp tục dùng hệ số đã lưu. Công hoặc lương giờ thay đổi thực sự vẫn làm mất hiệu lực quyết định duyệt theo cơ chế hiện có. Kỳ đã chốt vẫn bị khóa.

## Trước khi triển khai Neon

1. Tạm dừng các luồng ghi chấm công/lương trong cửa sổ triển khai. Lưu backup PostgreSQL và kiểm tra phục hồi được; dùng nhánh Neon hoặc nơi lưu được chủ dữ liệu chấp thuận. Không đưa dữ liệu lương thật vào Git hoặc DB local nếu chưa được cho phép.
2. Kiểm tra `_prisma_migrations`, schema thực tế và checksum. Ngày 30/10/2026 kiểm kê READ ONLY thấy 14 migration hoàn thành, gồm `20261030010000_remove_rate_kind_and_set_multipliers`; có 76 phiếu: 54 FINALIZED và 22 PENDING. Đây là ảnh chụp tại thời điểm kiểm tra, không thay thế kiểm kê trước triển khai.
3. Giữ nguyên migration đã chạy. Không dùng `migrate reset`, `db push --accept-data-loss` hoặc seed trên Neon. Nếu một môi trường từng chạy SQL thủ công, so sánh DDL trước khi dùng `prisma migrate resolve --applied`; không đánh dấu khi chưa chứng minh schema tương ứng.
4. Chạy thử trên nhánh Neon testing được phép. Lệnh `npm run test:neon` tạo một database tạm riêng và chạy các integration test bằng dữ liệu giả lập; không chạy fixture trực tiếp trên `neondb` hoặc `PBL6`.
5. Chỉ triển khai migration mới `20261030020000_preserve_payroll_history_and_version_policies` sau backup và đối chiếu. Migration chạy trong transaction, khóa hai bảng trong lúc chụp archive và cập nhật metadata. Sau đó triển khai backend/frontend tương ứng và sinh Prisma Client trong quy trình build.

## Migration mới làm gì

- Sao lưu nguyên bản từng phiếu vào `payroll_rate_repair_archive.original_record` trước khi thêm cờ đối soát.
- Giữ nguyên tất cả cột tiền, đơn giá, trạng thái và thời điểm cập nhật của phiếu. Chi tiết gốc giữ trong archive; chi tiết dạng object trên phiếu cũng được giữ cùng cờ `UNRESOLVED`.
- Không suy đoán đơn vị từ độ lớn của đơn giá. Mọi phiếu trước sửa được chặn tính lại/sửa/chốt cho đến khi đối soát; danh sách vẫn trả số thực lĩnh đã lưu và không tạo breakdown giả.
- Không mở khóa kỳ đã chốt nếu còn phiếu chưa xác minh, để tránh mở đường sửa lại công lịch sử trước đối soát. Phiếu lịch sử đã xác minh có thể dùng quy trình mở khóa hiện có khi nghiệp vụ cho phép; phiếu đã trả vẫn bị chặn.
- Mở rộng ba cột chính sách lên `numeric(15,4)`; giữ các bản ghi chưa rõ kỳ hiệu lực với `effective_period = NULL` để đối chiếu.
- Nếu đã có cấu hình, tạo phiên bản hệ số cho tháng triển khai từ cấu hình hợp lệ hiện tại; không gán ngược cho tháng trước. Thêm ràng buộc khoảng hệ số và trigger bảo vệ phiên bản.

Archive này chỉ giữ dữ liệu còn tồn tại lúc chạy migration sửa. Nó không khôi phục các cột đơn vị hay chính sách đã bị migration trước xóa/ghi đè. Muốn xác minh phần đã mất cần backup trước lần xóa hoặc nguồn nghiệp vụ đáng tin.

## Công cụ đối soát

Chạy trong `backend`, với kết nối đến DB đã được chủ dữ liệu cho phép. `npm run payroll:repair` mặc định chỉ kiểm kê bằng transaction READ ONLY. Báo cáo có dữ liệu lương; lưu trong nơi bảo mật, không commit. Có thể chỉ định JSON đã kiểm chứng để xem trước; chỉ `--apply` mới ghi DB.

Chỉ thêm `--export-originals` khi đã được cho phép xuất toàn bộ snapshot lương/chính sách. Chế độ mặc định không xuất nguyên bản chi tiết. Chuyển dữ liệu thật sang môi trường khác cần chấp thuận riêng cho dữ liệu và đích đến.

Ví dụ khôi phục cách tính một phiếu lịch sử; thay toàn bộ ID, timestamp, số tiền và nguồn bằng dữ liệu đã xác minh:

```json
{
  "source_reference": "backup-before-unit-removal / approved-review-ticket",
  "records": [{
    "id": "123",
    "expected_updated_at": "2026-10-30T00:00:00.000Z",
    "expected_net_salary": 950000,
    "overtime": {"value": 100000, "unit": "FIXED_PER_HOUR"},
    "late": {"value": 50000, "unit": "FIXED_PER_HOUR"}
  }]
}
```

```text
npm run payroll:repair -- path/to/verified.json
npm run payroll:repair -- path/to/verified.json --apply
```

Đối soát phiếu lịch sử phải tái tạo đúng thực lĩnh đã lưu. Công cụ chỉ thêm snapshot có nguồn và audit, không đổi tiền hoặc đơn giá gốc. Sai số hoặc dữ liệu thiếu làm rollback toàn bộ; không tự điều chỉnh phiếu đã trả. Phiếu đã xác minh được hiển thị theo đúng đơn vị cũ, bao gồm trường hợp lương giờ bằng 0.

Với phiếu PENDING cần chuyển sang chính sách hệ số đã được duyệt, cung cấp hai đơn vị `HOURLY_MULTIPLIER` và thêm `prepare_pending_recalculation: true`. Công cụ kiểm tra phiên bản hiện tại, giữ nguyên tiền, thay snapshot hệ số và xóa fingerprint cũ. Sau đó phải tính lại qua nghiệp vụ lương, đối soát chênh lệch và duyệt các khoản trước khi chốt. Không dùng tùy chọn này cho FINALIZED/CONFIRMED/PAID.

Phiếu PENDING đã xác minh theo đơn vị cũ (`LEGACY_VERIFIED`) cũng có thể chuyển tiếp bằng tùy chọn trên với timestamp mới nhất; không cần sửa trạng thái thủ công.

Có thể nhập lịch sử chính sách đã được xác minh bằng mảng `policies` trong cùng JSON, gồm `effective_period`, `overtime_rate`, `late_early_penalty`, `absence_penalty_rate`. Các hệ số chỉ nhận 0–50 với bốn chữ số thập phân; trùng tháng bị từ chối. Việc nhập được ghi audit với nguồn xác minh. Không tự tạo chính sách lịch sử chỉ để làm test hoặc phép tính chạy được.

## Xác nhận sau triển khai và phương án khôi phục

So sánh tổng số phiếu, tổng `net_salary` theo kỳ/trạng thái và từng snapshot với backup/archive. Kiểm tra phiếu cũ hiện trạng thái chưa xác minh, hệ số 0 vẫn hợp lệ, các mức 10 và 50 lưu/đọc đúng và thay chính sách tháng sau không đổi tháng trước. Không mở ghi lại nếu có sai lệch chưa giải thích.

Nếu triển khai lỗi, giữ dừng ghi và phục hồi trên nhánh/backup đã xác nhận cùng phiên bản ứng dụng tương ứng; không tự chạy SQL đảo migration trên Neon đang hoạt động. Archive hỗ trợ đối soát, không thay thế backup toàn DB.

## Kiểm thử

Runner đọc `backend/.env.testing`, xác minh endpoint Neon testing, tạo database `smartface_test_<id ngẫu nhiên>` riêng và tự xóa database đó khi hoàn tất. Mỗi bộ integration được chạy trên database tạm đã reset; SMTP/MQTT tắt. Các bài test từ chối kết nối tới DB chính, `neondb` và các database không có tên test hợp lệ. Báo cáo nằm trong `backend/tmp/neon-test-results`.

```text
npm run test:neon
npm test
npm run build
```

Frontend chạy `npm test`, `npm run lint`, `npm run build`. Các container, volume và runner PostgreSQL test local bằng Docker đã được xóa theo yêu cầu ngày 30/10/2026.

Seed chỉ chạy trên DB phát triển trống. Seed từ chối ngay trước bước xóa dữ liệu nếu đã có phiên bản chính sách bất biến, tránh xóa một phần dữ liệu rồi bị trigger chặn.

## Kết nối testing đã được chủ dự án cung cấp

Thông tin kết nối testing được giữ bền vững tại `backend/.env.testing`, được Git bỏ qua; bản tương thích cho script cũ tại `backend/tmp/db-validation-20261029/cloud-testing.env`. Endpoint direct là `ep-round-breeze-b3p8jbri.c-4.ap-southeast-1.aws.neon.tech`, database `neondb`. File `NEON_TESTING.md` trong thư mục script cũ ghi cách dùng cho các phiên làm việc sau. Không in hoặc đưa thông tin đăng nhập vào tài liệu/Git; kết nối nhánh chính vẫn lấy từ `backend/.env`.

Đã hoàn tất kiểm thử testing và áp dụng migration sửa lên main ngày 30/10/2026. Xem [báo cáo triển khai Neon](../../reports/NEON_PAYROLL_RELEASE_2026-10-30.md) để biết trạng thái mới nhất; các mục mô tả chưa triển khai ở phần trên là ghi nhận trước thời điểm triển khai.
