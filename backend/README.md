# ⚡ SmartFace Backend — Node.js & Express Modular Monolith API

> **SmartFace Backend** là dịch vụ trung tâm (Core RESTful API) và Real-time / IoT Gateway thuộc Hệ sinh thái Quản lý Nhân sự & Chấm công Thông minh SmartFace AIoT.  
> Hệ thống được thiết kế theo kiến trúc **Modular Monolith** chuẩn mực, cung cấp khả năng xác thực phân quyền đa tầng (RBAC), quản lý sinh trắc học khuôn mặt vector 512 chiều với PostgreSQL `pgvector`, quản lý ca kíp, tự động hóa tính lương và kết nối hai chiều với thiết bị Edge AI Camera qua WebSockets và MQTT.

---

## 📑 Mục lục
1. [Giới thiệu Backend](#1-giới-thiệu-backend)
2. [Yêu cầu môi trường](#2-yêu-cầu-môi-trường)
3. [Cài đặt](#3-cài-đặt)
4. [Cấu hình biến môi trường](#4-cấu-hình-biến-môi-trường)
5. [Database và Prisma](#5-database-và-prisma)
6. [Chạy Backend](#6-chạy-backend)
7. [API Documentation](#7-api-documentation)
8. [Cấu trúc thư mục](#8-cấu-trúc-thư-mục)
9. [Xử lý lỗi thường gặp](#9-xử-lý-lỗi-thường-gặp)

---

## 1. Giới thiệu Backend

### Vai trò của Backend trong hệ thống
* **API Gateway & Core Business Logic:** Xử lý toàn bộ logic nghiệp vụ cốt lõi về hồ sơ nhân sự, phân ca làm việc, tính toán giờ làm việc, phát hiện trễ/sớm và chốt kỳ lương tự động.
* **Xác thực & Bảo mật (RBAC):** Quản lý phiên đăng nhập qua Cookie `HttpOnly` an toàn, xác thực bằng JWT và kiểm soát quyền hạn 3 cấp: `ADMIN`, `MANAGER` và `EMPLOYEE`.
* **Biometric Vector Engine:** Lưu trữ các vector đặc trưng khuôn mặt 512-D được sinh ra từ model ArcFace, thực thi truy vấn tìm kiếm nhận diện gần đúng (Cosine similarity) bằng chỉ mục `HNSW` trên extension `pgvector` của PostgreSQL.
* **Real-time Event Hub:** Kết nối Socket.IO phát sự kiện chấm công trực tiếp (Live Feed) tới giao diện quản trị ngay khi thiết bị camera nhận diện thành công.
* **IoT Gateway:** Hỗ trợ kết nối MQTT Broker để nhận diện và trao đổi dữ liệu hai chiều với thiết bị biên (Edge AI Camera, Raspberry Pi, cảm biến vân tay).

### Công nghệ sử dụng
* **Nền tảng thực thi & Ngôn ngữ:** Node.js (v20+), TypeScript (v5.9)
* **Web Framework:** Express.js (v4.21)
* **ORM & Database:** Prisma ORM (v5.20), PostgreSQL 16 (kèm extension `pgvector` v0.8.6)
* **Giao thức Thời gian thực & IoT:** Socket.IO (v4.8), MQTT Client (`mqtt` v5.10)
* **Validation & DTO:** Zod (v3.23)
* **Mã hóa & Xác thực:** `bcryptjs` (băm mật khẩu), `jsonwebtoken` (ký JWT token)
* **Bảo mật mạng:** Helmet, CORS, Express Rate Limit, Cookie-parser
* **Dịch vụ Email:** Nodemailer (gửi thông tin tài khoản tự động cho nhân viên)
* **Testing:** Vitest (v2.1), Supertest (v7.3)

---

## 2. Yêu cầu môi trường

Để cài đặt và vận hành Backend, máy chủ hoặc môi trường cục bộ cần chuẩn bị:
* **Node.js:** Phiên bản `>= 20.0.0` (Khuyến nghị các bản LTS Node 20.x hoặc Node 22.x).  
  *Kiểm tra:* `node -v`
* **npm:** Phiên bản `>= 10.0.0`.  
  *Kiểm tra:* `npm -v`
* **PostgreSQL 16:** Đã kích hoạt extension `pgvector` (hỗ trợ cả PostgreSQL Local hoặc Neon Serverless PostgreSQL trên cloud).
* *(Tùy chọn)* **Docker & Docker Compose:** Dùng để dựng nhanh container PostgreSQL và pgAdmin nội bộ.

---

## 3. Cài đặt

1. Mở cửa sổ Terminal và di chuyển vào thư mục backend:
   ```bash
   cd backend
   ```
2. Cài đặt toàn bộ các thư viện phụ thuộc:
   ```bash
   npm install
   ```

---

## 4. Cấu hình biến môi trường

Backend đọc thông số cấu hình từ file `.env` đặt trực tiếp tại thư mục `backend/`. Bạn có thể tạo file `.env` từ file mẫu `.env.example`:

```bash
# Trên Windows (Command Prompt / PowerShell):
copy .env.example .env

# Trên Linux / macOS / Git Bash:
cp .env.example .env
```

### Danh sách các biến môi trường thực tế sử dụng:

| Tên biến | Kiểu dữ liệu | Ý nghĩa & Giá trị mẫu | Bắt buộc |
| :--- | :---: | :--- | :---: |
| `NODE_ENV` | `string` | Môi trường: `development` hoặc `production` | Có |
| `PORT` | `number` | Cổng HTTP Server lắng nghe (Mặc định: `3000`) | Có |
| `DATABASE_URL` | `string` | Chuỗi kết nối PostgreSQL (ví dụ: `postgresql://user:pass@ep-xyz.neon.tech/pbl6?sslmode=require`) | **Có** |
| `DIRECT_URL` | `string` | Chuỗi kết nối trực tiếp đến PostgreSQL (bỏ qua connection pooler, dùng cho Prisma migrate trên Neon) | Tùy chọn |
| `JWT_SECRET` | `string` | Chuỗi khóa bí mật dùng để ký và xác thực token JWT | **Có** |
| `CORS_ORIGIN` | `string` | Danh sách URL Frontend được phép kết nối (Mặc định: `http://localhost:5173`) | **Có** |
| `BIOMETRIC_ENCRYPTION_KEY` | `string` | Chuỗi 32-byte hex (64 ký tự) dùng để mã hóa vector khuôn mặt | Có |
| `FACE_AUTH_URL` | `string` | Địa chỉ microservice Python AI Face Recognition (Mặc định: `http://localhost:5000`) | Có |
| `ENABLE_MQTT` | `boolean` | Kích hoạt kết nối MQTT (`true` hoặc `false`) | Có |
| `MQTT_URL` | `string` | Địa chỉ MQTT Broker (ví dụ: `mqtt://localhost:1883`) | Tùy chọn |
| `MQTT_DEVICE_SECRET` | `string` | Khóa bí mật chia sẻ với thiết bị biên | Tùy chọn |
| `SMTP_HOST`, `SMTP_PORT` | `string/number` | Máy chủ gửi email (ví dụ: `smtp.gmail.com`, port `587`) | Tùy chọn |
| `SMTP_USER`, `SMTP_PASS` | `string` | Tài khoản & App Password gửi email thông báo | Tùy chọn |

---

## 5. Database và Prisma

### Bước 1: Khởi tạo Prisma Client
Tự động sinh bộ mã TypeScript client từ schema:
```bash
npm run prisma:generate
```

### Bước 2: Chạy Database Migration
Đồng bộ định nghĩa bảng từ `prisma/schema.prisma` vào CSDL PostgreSQL:
```bash
# Đối với môi trường phát triển (Development):
npx prisma migrate dev

# Hoặc áp dụng trực tiếp các bản migration đã có (Production / CI):
npm run prisma:migrate
```

### Bước 3: Nạp dữ liệu mẫu (Database Seeding)
Hệ thống cung cấp các kịch bản nạp dữ liệu toàn diện:
```bash
# Cách 1: Nạp toàn bộ dữ liệu mẫu một lần (Khuyến nghị):
npm run prisma:seed:all

# Hoặc nạp riêng từng thành phần:
npm run prisma:seed             # Tạo 3 Roles, 6 Phòng ban, 18 Chức vụ, tài khoản Admin và 18 Nhân viên
npm run prisma:seed:shifts      # Tạo lịch phân ca làm việc trong tháng
npm run prisma:seed:attendance  # Tạo dữ liệu quẹt thẻ và tổng hợp chấm công mẫu
```
> **Lưu ý bảo mật:** Toàn bộ thông tin cấu hình tài khoản và dữ liệu kiểm thử cục bộ được định nghĩa trong mã nguồn seed tại [prisma/seed.ts](file:///e:/PBL6/SmartFace-AIoT-Based-Staff-Management-Attendance-System/backend/prisma/seed.ts).


### Bước 4: Kiểm tra kết nối CSDL qua Prisma Studio
Khởi động giao diện quản trị Web GUI của Prisma để kiểm tra bảng và dữ liệu:
```bash
npm run prisma:studio
```
Truy cập tại địa chỉ: `http://localhost:5555`

---

## 6. Chạy Backend

### Chế độ Development (Hot-Reload)
Sử dụng `tsx watch` để tự động khởi động lại server khi phát hiện thay đổi trong mã nguồn:
```bash
npm run dev
```
> Server sẽ lắng nghe tại: `http://localhost:3000`

### Biên dịch & Chạy Production
```bash
# 1. Biên dịch TypeScript sang JavaScript trong thư mục dist/
npm run build

# 2. Khởi chạy server production
npm start
```

### Kiểm tra Health Endpoint
Bạn có thể kiểm tra trạng thái hoạt động của server bằng lệnh:
```bash
curl http://localhost:3000/health
```
Phản hồi thành công:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-10-25T12:00:00.000Z"
  }
}
```

---

## 7. API Documentation

Toàn bộ các endpoint đều có tiền tố `/api` (hoặc `/api/v1`). Phản hồi được chuẩn hóa theo định dạng envelope: `{ "success": true, "data": ... }`.

### 1. Nhóm Xác thực (`/api/auth`)
* `POST /api/auth/login`: Đăng nhập hệ thống, cấp phát HttpOnly Cookie chứa JWT token.
  * **Quyền:** Public
  * **Request:** `{ "username": "admin", "password": "<password>" }`
  * **Response:** `{ "success": true, "data": { "user": { "id": "...", "username": "admin", "role": "ADMIN" } } }`
* `GET /api/auth/me`: Lấy thông tin phiên đăng nhập hiện tại từ cookie.
  * **Quyền:** Authenticated (`ADMIN`, `MANAGER`, `EMPLOYEE`)
* `POST /api/auth/logout`: Xóa bỏ cookie phiên đăng nhập.

### 2. Nhóm Quản lý Nhân sự (`/api/employees`)
* `GET /api/employees`: Danh sách nhân viên (hỗ trợ phân trang, tìm kiếm và lọc theo phòng ban).
  * **Quyền:** `ADMIN`, `MANAGER`
* `GET /api/employees/:id`: Chi tiết hồ sơ nhân sự, lịch làm việc và thông tin chức vụ.
* `POST /api/employees`: Thêm mới nhân viên, tự động sinh mã `NV-xxx` và tạo tài khoản đăng nhập tương ứng.
  * **Quyền:** `ADMIN`, `MANAGER`
  * **Request:** `{ "full_name": "Nguyễn Văn B", "email": "b.nguyen@aiot.corp", "departmentId": 1, "positionId": 2, "hourly_rate": 100000 }`
* `PUT /api/employees/:id`: Cập nhật thông tin hồ sơ nhân viên.
* `PATCH /api/employees/:id/status`: Đổi trạng thái làm việc (`ACTIVE` / `INACTIVE`).

### 3. Nhóm Phòng ban & Chức vụ (`/api/departments`, `/api/positions`)
* `GET /api/departments`: Danh sách toàn bộ phòng ban.
* `POST /api/departments`: Tạo phòng ban mới.
* `GET /api/positions`: Danh sách chức vụ theo phòng ban.

### 4. Nhóm Chấm công (`/api/attendance`)
* `GET /api/attendance`: Danh sách nhật ký quẹt thẻ (lọc theo ngày, phòng ban, nhân viên).
* `POST /api/attendance/punch`: Ghi nhận lượt quẹt thẻ mới từ camera AI hoặc máy chấm công.
  * **Request:** `{ "employee_code": "NV-001", "type": "CHECK_IN", "method": "FACE", "verification_score": 0.98, "device_id": "FaceCam-01" }`
* `GET /api/attendance/summaries`: Lấy dữ liệu tổng hợp giờ công thực tế, số giây trễ/sớm và giờ OT.
* `POST /api/attendance/adjust`: Quản lý điều chỉnh hoặc phê duyệt giờ công, trễ/sớm và tăng ca.
* `POST /api/attendance/lock`: Chốt ca / khóa dữ liệu công của một ngày cụ thể.

### 5. Nhóm Phân ca làm việc (`/api/shifts`)
* `GET /api/shifts/templates`: Danh sách các ca mẫu (`Ca Hành Chính`, `Ca Sáng`, `Ca Chiều`, `Nghỉ ca OFF`).
* `GET /api/shifts/matrix`: Lấy ma trận phân ca của nhân viên theo tuần hoặc theo tháng.
* `POST /api/shifts/assign`: Phân ca cho nhân viên trong một ngày cụ thể.
* `POST /api/shifts/bulk-assign`: Phân ca hàng loạt theo phòng ban và khoảng ngày.

### 6. Nhóm Bảng lương (`/api/payroll`)
* `GET /api/payroll/records`: Tra cứu bảng lương theo kỳ (tháng/năm).
* `POST /api/payroll/calculate`: Kích hoạt tính toán bảng lương tự động từ dữ liệu chấm công.
* `POST /api/payroll/finalize`: Chốt sổ kỳ lương, không cho phép chỉnh sửa thêm.

---

## 8. Cấu trúc thư mục

Backend được tổ chức theo kiến trúc **Modular Monolith** phân chia theo các Domain Bounded Context:

```text
backend/
├── prisma/
│   ├── schema.prisma          # Database schema (15 models + pgvector)
│   ├── migrations/            # Lịch sử các phiên bản migration
│   ├── seed.ts                # Seed master data, tài khoản, 18 nhân viên
│   ├── seed-shifts.ts         # Seed lịch phân ca mẫu
│   └── seed-attendance.ts     # Seed dữ liệu chấm công và tổng hợp mẫu
├── src/
│   ├── common/                # Tiện ích dùng chung: Response envelope, EventBus, Serializers
│   ├── config/                # Cấu hình môi trường (env.ts validate qua Zod)
│   ├── middlewares/           # Middleware pipeline: auth, RBAC, validateDTO, errorHandler
│   ├── modules/               # 8 Domain Modules (Vertical Slices):
│   │   ├── auth/              # Xác thực, JWT, phân quyền
│   │   ├── employees/         # Nhân viên, phòng ban, chức vụ
│   │   ├── attendance/        # Chấm công, tổng hợp công, khóa ngày công, duyệt OT
│   │   ├── shifts/            # Ca mẫu, ma trận phân ca
│   │   ├── payroll/           # Tự động hóa tính lương, thưởng/phạt, chốt bảng lương
│   │   ├── biometrics/        # Vector ArcFace 512-D, pgvector HNSW
│   │   ├── devices/           # Thiết bị AIoT Camera / Máy quét vân tay
│   │   └── audit-logs/        # Nhật ký kiểm toán hành động hệ thống
│   ├── sockets/               # Socket.IO Server và các Real-time Gateways
│   ├── app.ts                 # Express Application setup, middleware pipeline
│   ├── routes.ts              # Tổng hợp router các module vào /api
│   └── server.ts              # Entry point: HTTP Server, Socket.IO, MQTT
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 9. Xử lý lỗi thường gặp

1. **Lỗi kết nối CSDL (`P1001: Can't reach database server`):**
   * *Nguyên nhân:* Sai chuỗi kết nối `DATABASE_URL`, mạng ngắt quãng hoặc máy chủ Neon tạm ngắt do nhàn rỗi.
   * *Khắc phục:* Kiểm tra file `.env`. Nếu dùng Neon, đảm bảo có tham số `?sslmode=require`.
2. **Lỗi Extension pgvector (`type "vector" does not exist`):**
   * *Khắc phục:* Đăng nhập vào PostgreSQL và kích hoạt extension vector bằng lệnh:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```
3. **Lỗi Prisma Client chưa sinh mã (`PrismaClientInitializationError`):**
   * *Khắc phục:* Chạy lệnh `npm run prisma:generate` để tạo lại client.
4. **Lỗi Port 3000 bị chiếm dụng (`EADDRINUSE: address already in use :::3000`):**
   * *Khắc phục:* Giải phóng tiến trình đang chiếm port 3000:
     ```bash
     # Trên Windows PowerShell:
     Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
     ```
5. **Lỗi xác thực JWT không hợp lệ hoặc hết hạn:**
   * *Khắc phục:* Đảm bảo biến `JWT_SECRET` trong `.env` có giá trị cố định và nhất quán giữa các lần khởi động server. Xóa cookie trình duyệt và thực hiện đăng nhập lại.
