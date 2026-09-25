# ⚡ SmartFace Backend — Node.js + Express + Prisma ORM

> **SmartFace Backend** là dịch vụ xử lý RESTful API chính và Real-time Gateway (Socket.IO & MQTT) thuộc Hệ thống Quản lý Nhân sự & Chấm công AIoT SmartFace.

---

## 🛠 Tech Stack Chi Tiết

| Thành phần | Công nghệ / Thư viện | Mô tả chức năng |
| :--- | :--- | :--- |
| **Runtime & Language** | Node.js (≥20), TypeScript (v5.8) | Đảm bảo an toàn kiểu dữ liệu nghiêm ngặt & hiệu năng xử lý bất đồng bộ cao |
| **Web Framework** | Express.js (v4.21) | Xây dựng REST API Router, Middleware Pipeline và Response Handlers |
| **ORM & Database** | Prisma ORM (v6.4), PostgreSQL 16 | Quản lý Database Schema (14 models), Type-safe Query Builder và Migrations |
| **Real-time Web** | Socket.IO (v4.8) | Broadcast sự kiện chấm công và trạng thái thiết bị tới Web Frontend qua WebSocket |
| **IoT Protocol** | MQTT Client (`mqtt` v5.10) | Nhận dữ liệu chấm công và trạng thái từ Edge AI Camera / ESP32 Nodes |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Cookies | Xác thực người dùng qua JWT cookie `HttpOnly; Secure; SameSite=Strict` & Bearer Header |
| **Data Validation** | Zod (v3.24) | Validate dữ liệu đầu vào DTO ở middleware layer trước khi tới Controller |
| **Security Layer** | Helmet, CORS, Biometric AES Encryption | Cấu hình HTTP Headers an toàn, phân quyền CORS & mã hóa vector đặc trưng AES-256 |

---

## 📋 Yêu Cầu Tiên Quyết (Prerequisites)

- **Node.js**: `≥ 20.0.0`
- **PostgreSQL**: `≥ 14.0` (Khuyên dùng PostgreSQL 16 tích hợp `pgvector`)
- **Docker Compose** *(Khuyên dùng để cài đặt DB nhanh chóng)*
- **MQTT Broker** *(Tùy chọn)*: Eclipse Mosquitto (`localhost:1883`) hoặc EMQX

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 🟢 Cách 1: Sử dụng Script Tự Động (`run.bat` tại thư mục gốc dự án)

Mở Terminal tại thư mục gốc `SmartFace-AIoT-Based-Staff-Management-Attendance-System/` và chọn menu tùy chọn:
- Select `[1]`: Chạy toàn bộ (Khởi động Docker DB + Backend + Frontend).
- Select `[3]`: Chỉ chạy riêng phân hệ Backend Service (`http://localhost:3000`).

---

### 🟡 Cách 2: Thực Hiện Thủ Công (Manual Step-by-Step)

#### Bước 1: Khởi động Database với Docker
```bash
# Trong thư mục backend/
docker compose up -d
```
*Lệnh này sẽ bật PostgreSQL tại port `5432` và pgAdmin tại port `5050`.*

#### Bước 2: Cài đặt Dependencies
```bash
cd backend
npm install
```

#### Bước 3: Cấu hình Biến Môi Trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
cp .env.example .env
```

#### Bước 4: Thực thi Prisma Migration & Seed Data
```bash
# Tạo các bảng trong Database theo schema.prisma
npm run prisma:migrate

# Nạp dữ liệu mẫu ban đầu (Roles, Admin, Employees, Shifts, Policy...)
npm run prisma:seed
```

#### Bước 5: Khởi chạy Server Development
```bash
npm run dev
# Server lắng nghe tại địa chỉ: http://localhost:3000
```

---

## 🔑 Biến Môi Trường (Environment Variables)

Danh sách 11 biến môi trường cấu hình trong file `backend/.env`:

| Tên biến | Mô tả chi tiết | Giá trị mẫu | Bắt buộc? |
| :--- | :--- | :--- | :---: |
| `NODE_ENV` | Môi trường ứng dụng (`development` / `production`) | `development` | 🔴 Có |
| `PORT` | Cổng kết nối HTTP Server | `3000` | 🔴 Có |
| `DATABASE_URL` | Chuỗi kết nối Database PostgreSQL | `postgresql://postgres:postgres@localhost:5432/PBL6` | 🔴 Có |
| `JWT_SECRET` | Chìa khóa bí mật dùng mã hóa & ký token JWT | `super_secret_jwt_key_random_pbl6_2026` | 🔴 Có |
| `JWT_EXPIRES_IN` | Thời gian hết hạn của Access Token | `1d` | 🟠 Tùy chọn |
| `MQTT_URL` | Địa chỉ kết nối Broker MQTT cho AIoT Devices | `mqtt://localhost:1883` | 🔴 Có |
| `MQTT_USERNAME` | Tài khoản đăng nhập MQTT Broker | `device_user` | 🟠 Tùy chọn |
| `MQTT_PASSWORD` | Mật khẩu đăng nhập MQTT Broker | `device_pass` | 🟠 Tùy chọn |
| `MQTT_DEVICE_SECRET` | Khóa bí mật xác thực gói tin từ Edge Device | `pbl6_device_shared_secret_key_12345678` | 🔴 Có |
| `BIOMETRIC_ENCRYPTION_KEY` | Hex Key 64 ký tự (AES-256) mã hóa sinh trắc học | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` | 🔴 Có |
| `CORS_ORIGIN` | URL Frontend được phép gọi API (CORS) | `http://localhost:5173` | 🔴 Có |

---

## 🔒 Tạo Khóa Bí Mật Mã Hóa (Secret Generation)

Để tạo mã ngẫu nhiên bảo mật 64 ký tự hex cho `JWT_SECRET` hoặc `BIOMETRIC_ENCRYPTION_KEY`, thực thi câu lệnh Node.js sau:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📜 NPM Scripts Chi Tiết

| Lệnh Script | Mô tả chức năng |
| :--- | :--- |
| `npm run dev` | Khởi chạy server phát triển tự động reload khi code thay đổi (`tsx watch`) |
| `npm run build` | Biên dịch toàn bộ mã nguồn TypeScript sang JavaScript chuẩn trong `dist/` |
| `npm start` | Chạy sản phẩm trong môi trường Production (`node dist/server.js`) |
| `npm run test` | Khởi chạy bộ kiểm thử Unit Test với `vitest` |
| `npm run prisma:generate` | Biên dịch tạo mới lại bộ TypeScript Client SDK cho Prisma |
| `npm run prisma:migrate` | Chạy bản SQL Migration cập nhật cấu trúc Database Schema |
| `npm run prisma:seed` | Nạp dữ liệu mặc định ban đầu vào các bảng |
| `npm run prisma:studio` | Mở giao diện đồ họa Web Prisma Studio quản lý dữ liệu Database |

---

## 📁 Cấu Trúc Thư Mục Backend

```text
backend/
├── docker-compose.yml       # Docker container PostgreSQL 16 & pgAdmin4
├── prisma/
│   ├── schema.prisma        # Cấu hình 14 Models Database Schema (kèm attendance_locks)
│   ├── seed.ts              # Script nạp dữ liệu mẫu khởi tạo hệ thống
│   └── README.md            # 📖 Tài liệu chi tiết Cơ sở dữ liệu Prisma -> prisma/README.md
├── src/
│   ├── server.ts            # Entry point khởi chạy Express Server, Socket.IO & MQTT Gateway
│   ├── app.ts               # Khởi tạo Express app, cookie-parser, Middlewares & API Routes
│   ├── config/              # Cấu hình DB, JWT, MQTT, CORS constants
│   ├── common/              # Response Helpers, Custom Error Handler, Logger, Date Utils
│   ├── middlewares/         # JWT Authentication, Zod Validation, Role Authorization
│   ├── sockets/             # Socket.IO Gateway quản lý kết nối realtime
│   └── modules/             # Các phân hệ nghiệp vụ chính (Modular Pattern)
│       ├── attendance/      # Điểm danh, Check-in/out logs, Lock date & Tổng hợp ngày
│       ├── audit-logs/      # Nhật ký thao tác hệ thống & sự kiện
│       ├── auth/            # Đăng nhập, Cookie Auth, me profile, đăng ký
│       ├── biometrics/      # Lưu trữ & mã hóa vector khuôn mặt, vân tay
│       ├── devices/         # Quản lý danh sách & trạng thái thiết bị AIoT
│       ├── employees/       # Quản lý danh sách & thông tin hồ sơ nhân viên
│       ├── payroll/         # Engine tự động tính lương tập trung, thưởng/phạt & chốt phiếu lương
│       └── shifts/          # Định nghĩa ca làm việc & phân lịch ca nhân viên
├── .env.example             # Mẫu biến môi trường
├── package.json             # Danh sách dependencies & NPM scripts
└── tsconfig.json            # Cấu hình TypeScript Compiler
```

---

## 🧱 Modular Architecture Pattern (Mô Hình 3 Lớp)

Mỗi module nghiệp vụ nằm trong `src/modules/` đều áp dụng thiết kế phân tách 3 lớp rõ ràng:

```text
src/modules/employees/
├── employee.dto.ts         # Khai báo kiểu DTO & Zod Schemas dùng cho Request Validation
├── employee.service.ts     # Xử lý Logic nghiệp vụ cốt lõi & truy vấn Database qua Prisma
└── employee.controller.ts  # Tiếp nhận Request, gọi Service & trả kết quả Response chuẩn hóa
```

---

## 🗄️ Database Schema (14 Models Chính)

| Model Name | Bảng Database | Mục đích & Chức năng | Dữ liệu Seed ban đầu |
| :--- | :--- | :--- | :---: |
| `User` | `users` | Tài khoản đăng nhập hệ thống | 3 users (`admin`, `manager`, `employee` - Mật khẩu: `Admin@123456`) |
| `Role` | `roles` | Danh mục vai trò (`ADMIN`, `MANAGER`, `EMPLOYEE`) | 3 roles |
| `Department` | `departments` | Danh mục phòng ban trong công ty | 4 phòng ban (`Quản lý`, `Thu ngân`, `Nhân viên`, `Bảo vệ`) |
| `Employee` | `employees` | Hồ sơ chi tiết thông tin nhân viên | 6 nhân viên mẫu |
| `AttendanceLog` | `attendance_logs` | Nhật ký từng lượt Check-in / Check-out | 25+ logs |
| `DailyAttendanceSummary`| `daily_attendance_summary` | Tổng hợp giờ làm, late_early & overtime (đơn vị: Giờ `Decimal(5,2)`) | 15+ summaries |
| `WorkShift` | `work_shifts` | Danh mục ca làm việc mẫu | 3 ca làm việc mẫu |
| `EmployeeShift` | `employee_shifts` | Lịch phân ca chi tiết cho nhân viên | 30+ ca phân lịch |
| `FaceEmbedding` | `face_embeddings` | Lưu trữ vector 512-D đặc trưng gương mặt (`vector(512)` + HNSW index) | 6 face vectors |
| `PayrollRecord` | `payroll_records` | Bảng lương chi tiết theo từng kỳ tháng | 6 phiếu lương mẫu |
| `BonusPenalty` | `bonus_penalty` | Quy định tỷ lệ thưởng OT & phạt đi trễ | 1 chính sách mẫu |
| `Device` | `devices` | Danh sách & trạng thái thiết bị AIoT Edge | 5 thiết bị mẫu (`ONLINE`, `OFFLINE`, `MAINTENANCE`) |
| `AuditLog` | `audit_logs` | Nhật ký ghi nhận các thao tác quan trọng | Tự động cập nhật |
| `attendance_locks` | `attendance_locks` | Quản lý khóa chốt chỉnh sửa dữ liệu chấm công theo từng ngày | 1 ngày khóa mẫu |

---

## 🔑 Tài Khoản Mặc Định (Seed Users)

Sau khi chạy lệnh `npm run prisma:seed`, hệ thống khởi tạo sẵn 3 tài khoản dùng chung mật khẩu: **`Admin@123456`**

| Username | Role | Vai trò | Mật khẩu |
| :--- | :--- | :--- | :--- |
| `admin` | `ADMIN` | Quản trị viên tối cao | `Admin@123456` |
| `manager` | `MANAGER` | Quản lý nhân sự & chấm công | `Admin@123456` |
| `employee` | `EMPLOYEE` | Nhân viên thông thường | `Admin@123456` |

---

## 🔌 Danh Sách API Endpoints (Main Routes)

| Method | Endpoint | Quyền truy cập | Chức năng chính |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Đăng nhập tài khoản, trả Cookie HttpOnly & JWT token |
| `POST` | `/api/auth/logout` | Authenticated | Đăng xuất & xóa Cookie xác thực |
| `GET` | `/api/auth/me` | Authenticated | Lấy thông tin hồ sơ tài khoản đang đăng nhập |
| `POST` | `/api/auth/register` | Admin | Đăng ký tài khoản người dùng mới |
| `GET` | `/api/employees` | Manager / Admin | Lấy danh sách nhân viên (hỗ trợ phân trang, tìm kiếm) |
| `POST` | `/api/employees` | Manager / Admin | Thêm mới hồ sơ nhân viên |
| `PUT` | `/api/employees/:id` | Manager / Admin | Cập nhật thông tin nhân viên |
| `DELETE` | `/api/employees/:id` | Admin | Xóa mềm nhân viên |
| `GET` | `/api/attendance` | Authenticated | Lấy danh sách nhật ký chấm công |
| `GET` | `/api/attendance/statistics` | Authenticated | Thống kê số lượt check-in hôm nay, thiết bị active |
| `POST` | `/api/attendance/check-in` | Manager / Admin / AIoT | Thực hiện Check-in sinh trắc học |
| `POST` | `/api/attendance/check-out` | Authenticated | Thực hiện Check-out sinh trắc học |
| `GET` | `/api/attendance/summaries` | Authenticated | Báo cáo tổng hợp điểm danh theo ngày |
| `GET` | `/api/attendance/locks` | Manager / Admin | Lấy danh sách trạng thái khóa chốt ca |
| `POST` | `/api/attendance/locks/lock` | Manager / Admin | Khóa chốt dữ liệu chấm công của ngày được chọn |
| `POST` | `/api/attendance/locks/unlock` | Manager / Admin | Mở khóa chỉnh sửa dữ liệu chấm công |
| `PATCH` | `/api/attendance/adjust` | Manager / Admin | Điều chỉnh thủ công giờ đi trễ/về sớm, tăng ca |
| `GET` | `/api/shifts` | Authenticated | Lấy danh sách lịch ca làm việc |
| `POST` | `/api/shifts` | Manager / Admin | Phân ca làm việc cho nhân viên |
| `GET` | `/api/payroll` | Authenticated | Lấy bảng lương (Nhân viên xem lương cá nhân) |
| `POST` | `/api/payroll/generate` | Manager / Admin | Tính toán bảng lương tự động cho kỳ (tập trung ở BE) |
| `PUT` | `/api/payroll/:id` | Manager / Admin | Cập nhật thông số phiếu lương cá nhân |
| `POST` | `/api/payroll/period/:period/finalize` | Manager / Admin | Chốt sổ bảng lương kỳ được chọn |
| `POST` | `/api/payroll/period/:period/unlock` | Admin | Mở khóa lại bảng lương đã chốt |
| `GET` | `/api/payroll/bonus-penalty` | Authenticated | Lấy quy định chính sách thưởng/phạt |
| `PUT` | `/api/payroll/bonus-penalty` | Manager / Admin | Cập nhật chính sách thưởng OT & phạt đi trễ |
| `GET` | `/api/biometrics/:employeeId` | Authenticated | Lấy thông tin vector gương mặt đã đăng ký |
| `POST` | `/api/biometrics/:employeeId` | Manager / Admin | Đăng ký vector khuôn mặt 512-D sinh trắc mới |
| `DELETE` | `/api/biometrics/:employeeId` | Manager / Admin | Xóa dữ liệu sinh trắc học của nhân viên |
| `GET` | `/api/devices` | Authenticated | Quản lý danh sách & trạng thái thiết bị AIoT |
| `POST` | `/api/devices` | Manager / Admin | Thêm mới thiết bị AIoT |
| `PUT` | `/api/devices/:id` | Manager / Admin | Cập nhật thông tin thiết bị AIoT |
| `DELETE` | `/api/devices/:id` | Admin | Xóa thiết bị AIoT |
| `GET` | `/api/audit-logs` | Admin | Lấy danh sách nhật ký kiểm toán hệ thống |

---

## 📡 Chuẩn Giao Tiếp MQTT Topics

Backend đăng ký lắng nghe (subscribe) các topic sau từ Broker MQTT (`mqtt.ts` & `device.mqtt.handler.ts`):

| Topic Pattern | Hướng gửi | Payload dữ liệu mẫu | Mục đích |
| :--- | :--- | :--- | :--- |
| `attendance/devices/+/check-in` | Device ➔ BE | `{"employeeId":"NV-001"}` | Nhận sự kiện check-in gương mặt từ AI Camera |
| `attendance/devices/+/status` | Device ➔ BE | `{"status":"ONLINE"}` | Báo cáo nhịp tim heartbeat trạng thái thiết bị |

---

## 🌐 Các Sự Kiện Socket.IO Real-time (Bảo Mật Với JWT Handshake)

Tất cả kết nối Socket.IO tới server và namespaces bắt buộc xác thực token JWT thông qua:
```javascript
const socket = io('http://localhost:3000/attendance', {
  auth: { token: 'eyJhbGciOiJIUzI1Ni...' }
})
```

### 1. Namespace `/attendance`
| Tên sự kiện (Event) | Hướng phát | Payload Structure | Mô tả |
| :--- | :--- | :--- | :--- |
| `connected` | Server ➔ Client | `{ namespace: '/attendance', user: { id, role } }` | Xác nhận kết nối & xác thực thành công |
| `checked-in` | Server ➔ Client | `{ id, employeeId, timestamp, method, device_info, ... }` | Phát sự kiện nhân viên check-in tức thì tới Dashboard |
| `checked-out` | Server ➔ Client | `{ id, employeeId, timestamp, device_info, ... }` | Phát sự kiện nhân viên check-out tức thì tới Dashboard |

### 2. Namespace `/devices`
| Tên sự kiện (Event) | Hướng phát | Payload Structure | Mô tả |
| :--- | :--- | :--- | :--- |
| `connected` | Server ➔ Client | `{ namespace: '/devices', user: { id, role } }` | Xác nhận kết nối & xác thực thành công |
| `status` | Server ➔ Client | `{ id, status: 'ONLINE'\|'OFFLINE', last_seen }` | Cập nhật nhịp tim trạng thái thiết bị |
| `created` | Server ➔ Client | `{ id, name, location, ip, status }` | Thông báo khi có thiết bị AIoT mới được tạo |
| `updated` | Server ➔ Client | `{ id, name, location, ip, status }` | Thông báo khi thiết bị AIoT được cập nhật |

---

## 🛠️ Hướng Dẫn Sửa Lỗi Thường Gặp (Troubleshooting)

1. **Lỗi `P1001: Can't reach database server`**:
   - Kiểm tra container PostgreSQL bằng `docker ps` hoặc xác nhận dịch vụ PostgreSQL đang chạy ở port 5432.
2. **Lỗi `Migration drift / P3005`**:
   - Chạy lệnh `npm run prisma:migrate` hoặc `npx prisma db push` để đồng bộ lại schema.
3. **Lỗi `EADDRINUSE: address already in use :::3000`**:
   - Port 3000 đang bị chiếm dụng. Thay đổi giá trị `PORT=3001` trong `.env` hoặc tắt ứng dụng đang dùng port 3000.
4. **Lỗi `./run.bat command not found` trong PowerShell/CMD**:
   - File `run.bat` nằm tại thư mục gốc của dự án. Hãy quay lại thư mục gốc bằng `cd ..` và gõ `.\run.bat`.

---

## 📄 License & Thông Tin

Dự án được phân phối theo giấy phép MIT. Xem thông tin chi tiết tại file [LICENSE](../LICENSE).
