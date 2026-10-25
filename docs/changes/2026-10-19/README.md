# Thay đổi ngày 19/10/2026

- [Backend](BACKEND_CHANGES.md): ghép công, quy tắc làm tròn phần lẻ, duyệt OT, tính lương, phân quyền, đồng bộ và migration.
- [Frontend](FRONTEND_CHANGES.md): số liệu công theo backend, duyệt OT, trạng thái thiết bị/mode, phiếu lương và realtime.
- [Hardware](HARDWARE_CHANGES.md): event ID, retry, timeout, tương quan phản hồi, latch/mode, camera và RTSP.
- [Face Auth](FACE_AUTH_CHANGES.md): recognition 1,0 giây, detection/PAD 0,2 giây, cập nhật cả môi trường và giá trị dự phòng.
- [Sắp xếp tài liệu](DOCUMENTATION_CHANGES.md): bảng đường dẫn trước/sau.

Quy định nghiệp vụ nằm tại [Chính sách công ty và dự án](../../rule/COMPANY_POLICY.md). Lệnh kiểm tra và triển khai nằm tại [hướng dẫn đưa bản sửa công/lương vào vận hành](../../tutorial/deployment/ATTENDANCE_PAYROLL_RELEASE.md).

Migration thêm cột/chỉ mục đã áp dụng trên Neon; không cập nhật/xóa dữ liệu nghiệp vụ. Code mới chưa thay tiến trình backend/frontend đang chạy hoặc triển khai lên Pi.
