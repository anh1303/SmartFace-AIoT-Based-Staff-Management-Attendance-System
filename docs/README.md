# Tài liệu SmartFace

## Quy tắc công ty và dự án — `rule/`

- [Chính sách điểm danh, tăng ca, tính lương, phân quyền và dữ liệu](rule/COMPANY_POLICY.md) — nguồn quy định nghiệp vụ; có đơn giá, công thức và tình huống minh họa.

## Kiến trúc — `architecture/`

- [Tổng quan dự án](architecture/PROJECT_OVERVIEW.md).
- [Kiến trúc và luồng dữ liệu](architecture/DATA_FLOWS.md).
- Tài liệu module: [Backend](../backend/README.md), [Database/Prisma](../backend/prisma/README.md), [Frontend](../frontend/README.md), [Face Auth](../face_auth/README.md), [Hardware](../hardware/README.md).

## Hướng dẫn — `tutorial/`

### Triển khai và vận hành

- [Hướng dẫn triển khai tổng thể](tutorial/deployment/DEPLOYMENT_GUIDE.md).
- [Chạy stack dùng DB cloud](tutorial/deployment/run_cloud_stack.md).
- [Chạy stack local](tutorial/deployment/run_full_stack.md).
- [Đưa bản sửa công/lương vào vận hành và chạy regression test](tutorial/deployment/ATTENDANCE_PAYROLL_RELEASE.md).

### ThingsBoard và Pi

- [Tổng hợp thiết lập ThingsBoard, dashboard và Pi](tutorial/thingsboard/THINGSBOARD_PI_SETUP.md).
- [Tạo Rule Chain và widget](tutorial/thingsboard/THINGSBOARD_GUIDE.md).
- [Dashboard exports và bản sao cấu hình](tutorial/thingsboard/DASHBOARD_EXPORTS.md).
- [Chạy phần cứng trên Pi](../hardware/RUN_ON_PI.md), [kế hoạch HC-SR04](../hardware/ULTRASONIC_EDGE_PLAN.md).

## Lịch sử thay đổi — `changes/`

- [Đợt 19/10/2026](changes/2026-10-19/README.md): backend, frontend, hardware, kiểm thử và sắp xếp tài liệu.

## Báo cáo và tài nguyên

- [Đánh giá báo cáo PBL6 ngày 15/10/2026](reports/danh_gia_bao_cao_smartface_2026-10-15.md).
- [Tài nguyên/export ThingsBoard](assets/thingsboard/).

```text
docs/
├── README.md
├── rule/                 # Quy định công ty và quy tắc nghiệp vụ
├── architecture/         # Tổng quan, kiến trúc, luồng dữ liệu
├── tutorial/
│   ├── deployment/       # Cài đặt, chạy hệ thống, triển khai và kiểm thử
│   └── thingsboard/      # ThingsBoard, dashboard, Rule Chain, kết nối Pi
├── changes/2026-10-19/    # Báo cáo thay đổi của từng phân hệ
├── reports/              # Đánh giá, báo cáo dự án
└── assets/thingsboard/   # JSON export và bản sao cấu hình
```

Các lệnh trong hướng dẫn được chạy từ thư mục gốc repository, trừ khi tài liệu ghi rõ thư mục khác. Chính sách tại `rule/` là căn cứ cho công/lương; báo cáo thay đổi tại `changes/` ghi trạng thái và bằng chứng của từng đợt triển khai.
