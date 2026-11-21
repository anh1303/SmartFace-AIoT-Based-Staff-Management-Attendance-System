# Seed dữ liệu demo

Seed tạo dữ liệu phát triển/demo. Chạy tại `backend/`, với database riêng đã cấu hình trong `.env`, áp dụng migrations và sinh Prisma Client. Không cần bật backend/frontend để thực thi seed.

## Các lệnh

| Lệnh | Vai trò |
| --- | --- |
| `npm run prisma:seed` | Tạo nền; từ chối nếu dữ liệu nền đã tồn tại |
| `npm run prisma:seed:shifts` | Phân ca theo tháng cho nhân viên đang hoạt động |
| `npm run prisma:seed:attendance` | Lượt quét/tổng hợp công theo tháng, ngày hoặc khoảng ngày |
| `npm run prisma:seed:scenarios` | Kịch bản bổ sung; đọc `scenarios.ts` trước khi chạy |
| `npm run prisma:seed:all` | Chạy nối tiếp seed nền, phân ca và chấm công |

Không chạy lại seed nền/`seed:all` trước mỗi lượt tạo ca/chấm công. Kiểm tra đúng database đích: seed có thể thay dữ liệu demo đã có trong phạm vi đủ điều kiện.

## Chuẩn bị

```sh
npm ci
npm run prisma:generate
npm run prisma:migrate
```

Chỉ chạy `npm run prisma:seed` khi cần tạo nền cho database mới. Chi tiết: [Prisma](../README.md).

## Tạo phân ca

```sh
npm run prisma:seed:shifts -- 2026-11 --mode skip
```

Chỉ nhận một tháng `YYYY-MM`. Bỏ đối số để nhập tháng/chế độ qua terminal. Ca gồm hành chính, sáng, chiều, đêm và nghỉ; giờ/phân bố được định nghĩa trong [shifts.ts](shifts.ts).

## Tạo chấm công

Tạo phân ca trước rồi chọn một phạm vi:

```sh
npm run prisma:seed:attendance -- 2026-11 --mode skip
npm run prisma:seed:attendance -- 2026-11-01 --mode skip
npm run prisma:seed:attendance -- 2026-11-01 2026-11-15 --mode skip
```

Không tạo dữ liệu trước ngày hồ sơ nhân viên được tạo. Ca đêm thuộc ngày bắt đầu ca; lượt ra vào ngày kế tiếp không tự thuộc ngày công kế tiếp.

## Chế độ và dữ liệu được bảo vệ

| Chế độ | Phân ca | Chấm công |
| --- | --- | --- |
| `skip` | Giữ phân ca đã có | Giữ ngày nhân viên đã có lượt quét, tổng hợp hoặc điều chỉnh |
| `overwrite` | Thay phân ca đủ điều kiện, đánh dấu công cần tính lại | Thay chấm công đủ điều kiện, giữ lịch phân ca |

Dùng `overwrite` khi chủ động tạo lại dữ liệu. Cả hai chế độ giữ ngày khóa, ngày đã duyệt/điều chỉnh thủ công, khoản đã duyệt/từ chối và kỳ lương không còn `PENDING`. Phiếu `PENDING` bị ảnh hưởng được đánh dấu cần tính lại. Mỗi lượt dùng transaction; lỗi rollback lượt đó.

Scenario tái lập theo nhân viên/ngày. Tỷ lệ trong [attendance.ts](attendance.ts) là phân bố mục tiêu demo, không phải thống kê thực tế hay cam kết mọi lần chạy đủ trường hợp.

## Kiểm tra kết quả

Đọc thống kê terminal và xem đúng kỳ trên ứng dụng. Seed không tự phê duyệt công hoặc tạo phiếu lương. Kiểm tra/duyệt theo nghiệp vụ trước khi tính lương; cron và trạng thái bảo vệ có thể ảnh hưởng thời điểm tổng hợp.

Xem cú pháp mà không thực thi seed:

```sh
npm run prisma:seed:shifts -- --help
npm run prisma:seed:attendance -- --help
```

Trên PowerShell bị chặn `npm.ps1`, dùng `npm.cmd`. Nếu nhiều ngày bị bỏ qua, kiểm tra khóa/duyệt/lương trước khi đổi chế độ; không dùng seed để ép mở dữ liệu bảo vệ.
