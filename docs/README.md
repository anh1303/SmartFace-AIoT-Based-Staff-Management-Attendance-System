# Tài liệu SmartFace

Bắt đầu từ [README dự án](../README.md) để chọn thành phần cần cài. Tài liệu có ngày là hồ sơ tại thời điểm ghi nhận, không xác nhận trạng thái triển khai hiện tại.

## Nghiệp vụ và kiến trúc

- [Chính sách công ty](rule/COMPANY_POLICY.md): căn cứ chấm công, tăng ca, lương và phân quyền.
- [Tổng quan hệ thống](architecture/PROJECT_OVERVIEW.md).
- [Kiến trúc/luồng dữ liệu](architecture/DATA_FLOWS.md).

## Hướng dẫn theo thành phần

| Thành phần | Tài liệu |
| --- | --- |
| API | [Backend](../backend/README.md) |
| Database | [Prisma](../backend/prisma/README.md), [seed](../backend/prisma/seeds/README-SEED.md) |
| Giao diện | [Frontend](../frontend/README.md) |
| Sinh trắc học | [Face Auth](../face_auth/README.md), [nghiên cứu/runtime](../face_auth/md/README.md) |
| Thiết bị | [Hardware](../hardware/README.md), [Pi](../hardware/RUN_ON_PI.md) |
| Giả lập | [Simulator](../scripts/realtime/README.md) |

## Triển khai

- [Triển khai tổng thể](tutorial/deployment/DEPLOYMENT_GUIDE.md).
- [Stack local](tutorial/deployment/run_full_stack.md).
- [Stack database cloud](tutorial/deployment/run_cloud_stack.md).
- [ThingsBoard/Pi](tutorial/thingsboard/THINGSBOARD_PI_SETUP.md).
- [Rule Chain và widget](tutorial/thingsboard/THINGSBOARD_GUIDE.md).
- [Dashboard exports](tutorial/thingsboard/DASHBOARD_EXPORTS.md).

Đối chiếu file Compose và `.env.example` tương ứng trước khi chạy lệnh cũ. Stack Phase 1 có base/override riêng, không ghép với stack IoT/local/cloud khác.

## Hồ sơ và tài nguyên

- [Lịch sử ngày 19/10/2026](changes/2026-10-19/README.md).
- [Tài nguyên ThingsBoard](assets/thingsboard/).
- `superpowers/`: kế hoạch/đánh giá/báo cáo có ngày; đọc trạng thái từng tài liệu riêng.
- `reports/`: báo cáo cục bộ, có thể không phân phối qua Git.

Không lấy số lượng test, IP máy thử hoặc câu “đã triển khai” trong hồ sơ cũ làm bằng chứng cho môi trường hiện tại. Đối chiếu lệnh với README thành phần, scripts và mã nguồn đang có.
