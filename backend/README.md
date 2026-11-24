# SmartFace Backend

API nghiệp vụ viết bằng TypeScript và Express: xác thực, phân quyền, nhân sự, ca, công, lương, thiết bị và tác vụ nền. Backend phát sự kiện realtime qua Socket.IO.

## Yêu cầu

- Node.js 22 và npm; phiên bản dependencies được khóa trong `package-lock.json`.
- PostgreSQL có extension `vector`.
- [Face Auth](../face_auth/README.md) khi dùng tính năng khuôn mặt; ThingsBoard/MQTT khi bật tích hợp thiết bị.

Chạy Prisma tại `backend/` bằng scripts trong [package.json](package.json), dùng cùng phiên bản CLI/client của backend.

## Cài đặt

Từ thư mục gốc dự án:

```sh
cd backend
npm ci
```

Sao chép [.env.example](.env.example) thành `.env`: dùng `cp .env.example .env` trên Linux/macOS hoặc `Copy-Item .env.example .env` trên PowerShell. Điền cấu hình thực tế và thay các khóa mẫu trước khi triển khai.

| Nhóm | Cấu hình chính |
| --- | --- |
| Database | `DATABASE_URL`, `DIRECT_URL` trỏ tới cùng database; URL trực tiếp dùng cho migration |
| Xác thực | `JWT_SECRET`, `MQTT_DEVICE_SECRET`, `BIOMETRIC_ENCRYPTION_KEY`: tối thiểu 32 ký tự theo bộ kiểm tra môi trường |
| HTTP | `PORT`, `CORS_ORIGIN`, `TRUST_PROXY_HOPS` |
| Face Auth | `FACE_AUTH_URL`, `FACE_AUTH_INTERNAL_KEY`, `FACE_AUTH_MODEL_VERSION`, `FACE_LOGIN_ENABLED` |
| Thiết bị | `ENABLE_MQTT`, `MQTT_URL`, các biến `TB_*` |
| Tác vụ nền | `ENABLE_ATTENDANCE_CRON`, `OPERATION_RECOVERY_INTERVAL_MS`, `ATTENDANCE_ALERTS_INTERVAL_MS` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `CLIENT_URL` |

Danh sách và kiểm tra chính xác: [env.ts](src/config/env.ts). Dùng cùng internal key/embedding version với Python. `TRUST_PROXY_HOPS` phải khớp số reverse proxy thực tế.

## Database

Sau khi xác nhận đúng database đích:

```sh
npm run prisma:generate
npm run prisma:migrate
```

`prisma:migrate` áp dụng migrations đã có và có thể thay đổi schema. Không cần seed để khởi động trên database đã có dữ liệu. Nếu cần dữ liệu demo, đọc [hướng dẫn seed](prisma/seeds/README-SEED.md) trước khi chạy.

Chi tiết schema/migration: [Prisma](prisma/README.md).

## Chạy dịch vụ

Các lệnh sau chạy tại `backend/`:

```sh
npm run dev
```

Hoặc chạy bản build:

```sh
npm run build
npm start
```

Server mặc định tại `http://localhost:3000`. `GET /health` kiểm tra tiến trình, không thay thế kiểm tra database hoặc dịch vụ Python.

## API và mã nguồn

Route được gắn tại `/api` và `/api/v1` trong [app.ts](src/app.ts). Các nhóm API nằm trong [routes.ts](src/routes.ts); hợp đồng chi tiết nằm trong `*.routes.ts` và `*.dto.ts` của từng module.

- `src/modules/`: auth, employees, attendance, shifts, payroll, biometrics, devices, operations, dashboard, reports và audit-logs. Thông báo thuộc module attendance.
- `src/common/`: lỗi, response, event bus và tiện ích chung.
- `src/config/`: môi trường, database và hạ tầng.
- `src/sockets/`: xác thực/phạm vi truy cập Socket.IO.
- `src/composition.ts`: lắp ghép các port giữa module.
- `prisma/schema/`, `prisma/migrations/`, `prisma/seeds/`: schema, migration và seed.

Gọi module khác qua public entry point hoặc port hiện có. Quy tắc công/lương nằm trong [chính sách công ty](../docs/rule/COMPANY_POLICY.md).

## Kiểm tra

```sh
npm run build
npm test
```

`npm test` chạy các test còn lại trong `src/__tests__/` và `validation/`. Test database/socket có điều kiện bật riêng; skipped không xác nhận luồng đó đã được kiểm chứng.

```sh
npm run test:neon
```

Runner Neon đọc `backend/.env.testing`, yêu cầu endpoint kiểm thử riêng, tạo database tạm, chạy migrations/test rồi xóa database tạm. Đọc [runner](validation/tools/run-neon-tests.mjs) và [guard](src/__tests__/helpers/cloud-test-db.mjs) trước khi cấu hình; không dùng endpoint database ứng dụng.

## Lỗi thường gặp

| Hiện tượng | Kiểm tra |
| --- | --- |
| Môi trường không hợp lệ | Biến bắt buộc và độ dài khóa trong `.env` |
| Prisma chưa có client | `npm run prisma:generate` tại `backend/` |
| Không có kiểu `vector` | Extension PostgreSQL và migrations |
| Đăng nhập/realtime lỗi sau proxy | CORS, cookie, origin, `TRUST_PROXY_HOPS` |
| Face Auth chưa sẵn sàng | URL, internal key, `GET /health/ready` của Python |
