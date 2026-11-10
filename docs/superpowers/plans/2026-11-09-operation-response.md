# Giảm thời gian nhận kết quả tác vụ

**Mục tiêu:** Giao diện xác nhận kết quả tác vụ ngay khi có sự kiện server, vẫn đọc trạng thái thực và polling dự phòng.

**Phạm vi:** `OperationsProvider.tsx` chuyển tiếp sự kiện; `commandApi.ts` chờ sự kiện theo job, tránh mất sự kiện trong lúc đang đọc; `operation-wait.test.ts` kiểm thử sự kiện, kết quả và polling. Không thay đổi xác nhận lưu hoặc bảo mật.

- [x] Viết kiểm thử tác vụ hoàn tất khi sự kiện đến trong lúc chờ, trước nhịp polling; xác nhận thất bại trước sửa.
- [x] Chuyển tiếp sự kiện hiện có và đánh thức đúng tác vụ; duy trì polling, xử lý lỗi, phiên và dọn listener.
- [x] Chạy kiểm thử tập trung, toàn bộ frontend và kiểm tra kiểu. Chưa đo được cải thiện đầu-cuối trên hệ thống thực tế.

Các tối ưu worker, đo các thành phần khác và nghiệm thu trên thiết bị là công việc tiếp theo theo `docs/ke-hoach-toi-uu-thoi-gian-phan-hoi.md`.
