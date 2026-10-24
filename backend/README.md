# ⚡ SmartFace Backend — Node.js & Express Modular Monolith API

> **SmartFace Backend** là dịch vụ RESTful API trung tâm và Real-time / IoT Gateway thuộc Hệ sinh thái Quản lý Nhân sự & Chấm công Thông minh SmartFace AIoT.  
> Hệ thống được xây dựng theo kiến trúc **Modular Monolith** chuẩn mực, cung cấp khả năng xác thực phân quyền đa tầng, xử lý dữ liệu sinh trắc học khuôn mặt vector 512 chiều với PostgreSQL `pgvector`, quản lý phân ca, tự động hóa tính lương và đồng bộ hai chiều với thiết bị Edge AI Camera qua WebSockets và MQTT.

---

## 🛠 Tech Stack

| Phân tầng | Công nghệ / Thư viện | Vai trò & Ứng dụng |
| :--- | :--- | :--- |
| **Runtime & Ngôn ngữ** | Node.js (≥20), TypeScript (v5.9) | Nền tảng thực thi bất đồng bộ hiệu năng cao với kiểm tra kiểu tĩnh nghiêm ngặt |
| **Web Framework** | Express.js (v4.21) | Xây dựng REST API Router, Middleware Pipeline và chuẩn hóa phản hồi |
| **ORM & Database** | Prisma ORM (v5.20), PostgreSQL 16 | Quản lý Database Schema, Type-safe Query Builder và tự động hóa migration |
| **Biometric Search** | pgvector (v0.8.6) | Lưu trữ vector 512-D ArcFace và truy vấn tìm kiếm tương đồng Cosine qua HNSW Index |
| **Real-time Gateway** | Socket.IO (v4.8) | Phát sự kiện chấm công và đồng bộ trạng thái thiết bị thời gian thực với JWT Handshake |
| **IoT Protocol** | MQTT Client (`mqtt` v5.10) | Nhận dữ liệu chấm công và telemetry từ Edge AI Camera / Raspberry Pi / ThingsBoard |
| **Event-Driven Bus** | In-Process EventBus (`EventEmitter`) | Kiến trúc Decoupled Pub/Sub nội bộ giữa Business Services và Socket Gateways |
| **Authentication & RBAC**| JWT (`jsonwebtoken`), `bcryptjs`, Cookies | Xác thực phiên làm việc qua Cookie `HttpOnly` an toàn kết hợp phân quyền theo vai trò |
| **Data Validation** | Zod (v3.23) | Xác thực và chuẩn hóa dữ liệu đầu vào (DTO) ngay tại middleware pipeline |
| **Security Layer** | Helmet, CORS, Express Rate Limit | Bảo vệ HTTP headers, kiểm soát nguồn gốc truy cập và chống tấn công quá tải |
| **Automated Testing** | Vitest (v2.1), Supertest | Bộ kiểm thử tự động toàn diện cho Unit tests, Integration tests, RBAC và Socket |

---

## 🏛️ Kiến Trúc Hệ Thống (Modular Monolith)

Toàn bộ backend được tổ chức theo kiến trúc **Modular Monolith**. Hệ thống được chia tách thành các **Bounded Context** độc lập theo từng domain nghiệp vụ. Mỗi module đóng gói hoàn chỉnh từ Route, Controller, Service đến Data Access Layer (Repository).

```text
backend/src/modules/<module_name>/
├── <module>.routes.ts       # Định nghĩa API Router, gắn Auth/RBAC middleware và Zod validator
├── <module>.controller.ts   # Tiếp nhận Request, gọi Service và trả về Response chuẩn hóa
├── <module>.service.ts      # Core Business Logic, xử lý nghiệp vụ và kiểm soát ràng buộc
├── <module>.repository.ts   # Data Access Layer đóng gói các truy vấn Prisma cho module
├── <module>.dto.ts          # Zod Schemas và TypeScript DTO types suy luận runtime
├── <module>.model.ts        # Prisma selection payloads & helper types
├── <module>.gateway.ts      # (Tùy chọn) Socket.IO Gateway lắng nghe Domain Events của module
└── index.ts                 # Public API Facade — Cổng giao tiếp DUY NHẤT cho các module khác
```

### Nguyên Tắc Thiết Kế Cốt Lõi:

1. **Zero Cross-Module Direct Database Access:**  
   Một module **không truy cập trực tiếp** bảng CSDL do module khác sở hữu thông qua `prisma.<other_table>`. Mọi tương tác xuyên module bắt buộc phải thông qua **Public API Facade (`index.ts`)** của module sở hữu dữ liệu.
2. **Hỗ Trợ Giao Dịch Toàn Vẹn Liên Module (Atomic Transactions):**  
   Các hàm Public API thay đổi dữ liệu xuyên module đều hỗ trợ tham số tùy chọn `tx?: Prisma.TransactionClient`. Nhờ đó, các thao tác nghiệp vụ phức tạp (ví dụ: tạo hồ sơ nhân sự đồng thời tạo tài khoản người dùng) được thực thi trong một transaction duy nhất, đảm bảo tính nhất quán dữ liệu (Rollback nếu xảy ra lỗi ở bất kỳ bước nào).
3. **Decoupled Real-time Qua In-Process Event Bus:**  
   Business Services không trực tiếp phụ thuộc vào transport layer (Socket.IO hay MQTT). Khi có sự kiện phát sinh (ví dụ: nhân viên quẹt thẻ thành công), Service chỉ phát tín hiệu qua `eventBus.publish(...)`. Các Socket Gateways đăng ký lắng nghe sự kiện và tự động broadcast tới client tương ứng.
4. **Kiến Trúc Phi Chu Trình (Acyclic Dependencies):**  
   Các logic liên quan đến khóa dữ liệu chấm công được trừu tượng hóa độc lập, ngăn chặn hoàn toàn nguy cơ phụ thuộc vòng tròn giữa module Chấm công (`attendance`) và Phân ca (`shifts`).

---

## 📂 Cấu Trúc Thư Mục Dự Án

```text
backend/
├── database/                # Scripts SQL và extension khởi tạo
├── prisma/                  # Prisma Schema, Migrations và Seeding scripts
│   ├── schema.prisma        # Database Schema hoàn chỉnh (15 models + pgvector)
│   ├── migrations/          # Lịch sử các bản migration CSDL
│   ├── seed.ts              # Khởi tạo Master Data (Roles, Users, Departments, Positions, Shifts, Devices)
│   ├── seed-shifts.ts       # Khởi tạo dữ liệu phân ca mẫu
│   └── seed-attendance.ts   # Khởi tạo dữ liệu chấm công và tổng hợp mẫu
├── src/
│   ├── common/              # Tiện ích dùng chung (EventBus, Response Envelopes, Serializer)
│   ├── config/              # Cấu hình hệ thống, validate biến môi trường qua Zod
│   ├── middlewares/         # Middleware Pipeline: Auth, RBAC, Zod Validator, Error Handler
│   ├── modules/             # 8 Domain Modules (Vertical Slices)
│   │   ├── attendance/      # Chấm công AIoT, nhật ký quẹt thẻ, khóa ngày công, tổng hợp công
│   │   ├── audit-logs/      # Ghi vết và tra cứu nhật ký kiểm toán hệ thống
│   │   ├── auth/            # Xác thực, JWT, phân quyền Role, quản lý mật khẩu
│   │   ├── biometrics/      # Quản lý vector đặc trưng 512-D ArcFace, tích hợp pgvector
│   │   ├── devices/         # Quản lý thiết bị AIoT, heartbeat, đồng bộ chế độ hoạt động
│   │   ├── employees/       # Quản lý hồ sơ nhân sự, phòng ban và chức vụ
│   │   ├── payroll/         # Tính lương tự động, chính sách thưởng/phạt, chốt kỳ lương
│   │   └── shifts/          # Ca làm việc mẫu, bảng phân ca nhân viên theo tháng
│   ├── sockets/             # Khởi tạo Socket.IO Server và quản lý Namespaces
│   ├── app.ts               # Khởi tạo Express Application, gắn middlewares và route table
│   ├── routes.ts            # Tổng hợp các Router con vào tiền tố chung `/api`
│   └── server.ts            # Entry point: HTTP Server, Socket.IO, MQTT Client listener
├── Dockerfile               # Cấu hình containerization cho Backend
├── package.json             # Cấu hình dependencies và npm scripts
└── tsconfig.json            # Cấu hình biên dịch TypeScript
```

---

## 🧩 Tổng Quan 8 Domain Modules

| Module | Trách nhiệm chính | Bảng CSDL trực tiếp sở hữu |
| :--- | :--- | :--- |
| **`auth`** | Đăng nhập, đăng xuất, cấp phát JWT, băm mật khẩu và phân quyền RBAC | `users`, `roles` |
| **`employees`** | Quản lý hồ sơ nhân viên, tổ chức phòng ban và danh mục chức vụ | `employees`, `departments`, `positions` |
| **`attendance`** | Tiếp nhận sự kiện chấm công (Khuôn mặt/Vân tay), khóa công và tổng hợp công ngày | `attendance_logs`, `daily_attendance_summary`, `attendance_locks` |
| **`shifts`** | Định nghĩa ca làm việc mẫu và phân bổ ca làm việc cho nhân viên theo lịch | `work_shifts`, `employee_shifts` |
| **`payroll`** | Tính toán bảng lương tự động từ công thực tế, quản lý thưởng/phạt và chốt kỳ lương | `payroll_records`, `bonus_penalty` |
| **`biometrics`** | Quản lý vector khuôn mặt 512-D, lưu trữ Centroid đại diện và đối soát tương đồng | `face_embeddings` |
| **`devices`** | Quản lý thông tin thiết bị AIoT, kiểm tra heartbeat và đồng bộ chế độ hoạt động | `devices` |
| **`audit-logs`** | Ghi nhận và truy vết các thay đổi dữ liệu nhạy cảm trên toàn hệ thống | `audit_logs` |

---

## 📡 Real-time Gateways & Kết Nối Ngoại Vi

### 1. Socket.IO Gateway
Máy chủ hỗ trợ 2 namespaces chuyên trách với cơ chế xác thực JWT bắt buộc trong quá trình bắt tay kết nối (*Handshake*):

#### Namespace `/attendance`:
- **Sự kiện `checked-in`**: Broadcast ngay khi nhân viên quẹt thẻ vào ca (gương mặt/vân tay) kèm theo thông tin nhân viên, thời gian, độ tin cậy và trạng thái trễ/đúng giờ.
- **Sự kiện `checked-out`**: Broadcast ngay khi nhân viên chấm công ra ca kèm tổng giờ làm tích lũy.

#### Namespace `/devices`:
- **Sự kiện `status`**: Cập nhật trạng thái kết nối nhịp tim heartbeat của các thiết bị AIoT (`ONLINE` / `OFFLINE` / `MAINTENANCE`).
- **Sự kiện `created` / `updated`**: Thông báo tức thời khi có thiết bị mới hoặc có thay đổi cấu hình.

---

### 2. MQTT Client Gateway ([src/config/mqtt.ts](src/config/mqtt.ts))
Lắng nghe các topic telemetry từ phần cứng Edge Camera và Máy vân tay:

| MQTT Topic Pattern | Hướng truyền | Mục đích xử lý |
| :--- | :---: | :--- |
| `attendance/devices/+/check-in` | Device ➔ BE | Tiếp nhận sự kiện nhận diện thành công từ Edge AI Camera |
| `attendance/devices/+/status` | Device ➔ BE | Tiếp nhận bản tin nhịp tim (heartbeat) định kỳ của thiết bị |

---

## 🔌 Danh Sách REST API Endpoints

### 1. Xác Thực & Người Dùng (`/api/auth`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/login` | Public | Đăng nhập tài khoản, thiết lập Cookie `HttpOnly` chứa JWT |
| `POST` | `/api/auth/logout` | Authenticated | Đăng xuất và hủy Cookie phiên làm việc |
| `GET` | `/api/auth/me` | Authenticated | Lấy thông tin tài khoản và quyền hạn hiện tại |
| `POST` | `/api/auth/register` | `ADMIN` | Đăng ký tài khoản người dùng mới |
| `POST` | `/api/auth/change-password` | Authenticated | Đổi mật khẩu tài khoản đang đăng nhập |

### 2. Nhân Sự, Phòng Ban & Chức Vụ (`/api/employees`, `/api/departments`, `/api/positions`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/employees` | `MANAGER`, `ADMIN` | Danh sách nhân viên (hỗ trợ tìm kiếm, lọc phòng ban, phân trang) |
| `GET` | `/api/employees/:id` | `MANAGER`, `ADMIN` | Lấy chi tiết hồ sơ nhân sự |
| `POST` | `/api/employees` | `MANAGER`, `ADMIN` | Thêm nhân viên mới (tự động tạo tài khoản, băm mật khẩu và gửi email) |
| `PUT` | `/api/employees/:id` | `MANAGER`, `ADMIN` | Cập nhật hồ sơ nhân sự, mức lương giờ, phòng ban, chức vụ |
| `DELETE` | `/api/employees/:id` | `ADMIN` | Xóa nhân viên và tài khoản liên kết trong một transaction |
| `GET` | `/api/departments` | Authenticated | Lấy danh sách các phòng ban |
| `POST` | `/api/departments` | `ADMIN` | Thêm mới phòng ban |
| `PUT` | `/api/departments/:id` | `ADMIN` | Cập nhật thông tin phòng ban |
| `GET` | `/api/positions` | Authenticated | Lấy danh sách chức vụ (lọc theo phòng ban) |
| `POST` | `/api/positions` | `ADMIN` | Thêm mới chức vụ |
| `PUT` | `/api/positions/:id` | `ADMIN` | Cập nhật thông tin chức vụ |

### 3. Chấm Công & Khóa Dữ Liệu (`/api/attendance`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/attendance` | Authenticated | Lấy danh sách nhật ký chấm công (Nhân viên chỉ xem dữ liệu của mình) |
| `GET` | `/api/attendance/statistics` | Authenticated | Thống kê số lượng đi làm hôm nay, tỷ lệ đúng giờ, vắng mặt |
| `POST` | `/api/attendance/check-in` | All / Device | Ghi nhận chấm công vào ca (Khuôn mặt / Vân tay), tự tính đi trễ |
| `POST` | `/api/attendance/check-out` | All / Device | Ghi nhận chấm công ra ca, tính tổng số giờ làm việc thực tế |
| `GET` | `/api/attendance/summaries` | Authenticated | Lấy dữ liệu bảng tổng hợp công theo ngày (`daily_attendance_summary`) |
| `PATCH` | `/api/attendance/adjust` | `MANAGER`, `ADMIN` | Điều chỉnh thủ công giờ công (chặn nếu ngày đã bị khóa công) |
| `GET` | `/api/attendance/locks` | Authenticated | Lấy danh sách trạng thái khóa chốt ca theo ngày |
| `POST` | `/api/attendance/locks/lock` | `MANAGER`, `ADMIN` | Khóa chốt dữ liệu chấm công theo ngày |
| `POST` | `/api/attendance/locks/unlock` | `MANAGER`, `ADMIN` | Mở khóa chỉnh sửa dữ liệu chấm công |
| `POST` | `/api/attendance/aggregate` | `MANAGER`, `ADMIN` | Kích hoạt tổng hợp dữ liệu từ nhật ký quẹt thẻ sang bảng tổng hợp ngày |

### 4. Ca Làm Việc & Phân Ca (`/api/shifts`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/shifts` | Authenticated | Lấy danh mục ca làm việc mẫu (`work_shifts`) |
| `POST` | `/api/shifts` | `ADMIN` | Tạo ca làm việc mẫu mới |
| `GET` | `/api/shifts/schedules` | Authenticated | Lấy bảng phân ca chi tiết theo tháng |
| `POST` | `/api/shifts/assign` | `MANAGER`, `ADMIN` | Phân ca làm việc cho nhân viên |
| `POST` | `/api/shifts/batch-assign` | `MANAGER`, `ADMIN` | Phân ca làm việc hàng loạt cho toàn bộ nhân viên trong phòng ban |

### 5. Quản Lý Tính Lương (`/api/payroll`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/payroll` | Authenticated | Lấy danh sách bảng lương theo kỳ (`payroll_period: YYYY-MM`) |
| `POST` | `/api/payroll/generate` | `MANAGER`, `ADMIN` | Tự động tổng hợp công và tính toán bảng lương tháng |
| `PUT` | `/api/payroll/:id` | `MANAGER`, `ADMIN` | Cập nhật phụ cấp, thưởng, phạt cho phiếu lương cụ thể |
| `POST` | `/api/payroll/period/:period/finalize` | `MANAGER`, `ADMIN` | Chốt sổ bảng lương kỳ được chọn |
| `POST` | `/api/payroll/period/:period/unlock` | `ADMIN` | Mở khóa lại bảng lương đã chốt |
| `GET` | `/api/payroll/bonus-penalty` | Authenticated | Lấy cấu hình tỷ lệ thưởng OT và mức phạt đi trễ |
| `PUT` | `/api/payroll/bonus-penalty` | `MANAGER`, `ADMIN` | Cập nhật chính sách thưởng OT và phạt trễ/sớm |

### 6. Sinh Trắc Học Khuôn Mặt (`/api/biometrics`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/biometrics/:employeeId` | Authenticated | Kiểm tra trạng thái đăng ký vector khuôn mặt của nhân viên |
| `POST` | `/api/biometrics/:employeeId` | `MANAGER`, `ADMIN` | Lưu trực tiếp vector đặc trưng khuôn mặt 512-D |
| `POST` | `/api/biometrics/:employeeId/enroll-images` | `MANAGER`, `ADMIN` | Gửi tập ảnh gương mặt để trích xuất Centroid vector |
| `DELETE` | `/api/biometrics/:employeeId` | `MANAGER`, `ADMIN` | Xóa dữ liệu mẫu sinh trắc học của nhân viên |

### 7. Thiết Bị AIoT & Nhật Ký Kiểm Toán (`/api/devices`, `/api/audit-logs`)
| Method | Endpoint | Quyền hạn | Mô tả chức năng |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/devices` | Authenticated | Lấy danh sách và trạng thái hoạt động của các thiết bị AIoT |
| `POST` | `/api/devices` | `MANAGER`, `ADMIN` | Đăng ký thiết bị AIoT mới vào hệ thống |
| `PUT` | `/api/devices/:id` | `MANAGER`, `ADMIN` | Cập nhật thông số mạng, vị trí lắp đặt của thiết bị |
| `DELETE` | `/api/devices/:id` | `ADMIN` | Xóa thiết bị khỏi hệ thống |
| `GET` | `/api/devices/:id/mode` | All / Device | Lấy chế độ hoạt động hiện tại của thiết bị |
| `PATCH` | `/api/devices/:id/mode` | `MANAGER`, `ADMIN` | Yêu cầu đổi chế độ thiết bị (`CHECK_IN`, `CHECK_OUT`, `STANDBY`) |
| `POST` | `/api/devices/:id/mode-notify` | All / Device | Thiết bị xác nhận đã chuyển đổi chế độ phần cứng thành công |
| `GET` | `/api/audit-logs` | `ADMIN` | Tra cứu nhật ký kiểm toán toàn hệ thống |

---

## 🔑 Cấu Hình Biến Môi Trường (`.env`)

Tất cả các biến môi trường đều được xác thực và chuẩn hóa ngay khi khởi động thông qua [src/config/env.ts](src/config/env.ts):

| Tên biến | Kiểu dữ liệu | Mặc định | Bắt buộc | Mục đích & Mô tả |
| :--- | :---: | :---: | :---: | :--- |
| `NODE_ENV` | `string` | `'development'` | Không | Môi trường ứng dụng (`development`, `production`, `test`) |
| `PORT` | `number` | `3000` | Không | Cổng lắng nghe của HTTP API Server |
| `DATABASE_URL` | `string` | — | **Có** | Chuỗi kết nối PostgreSQL (kèm extension `pgvector`) |
| `DIRECT_URL` | `string` | — | Không | Kết nối trực tiếp CSDL cho Prisma Migrate & Seeding |
| `JWT_SECRET` | `string` | — | **Có** | Khóa bí mật ký mã token JWT (tối thiểu 32 ký tự) |
| `JWT_EXPIRES_IN` | `string` | `'7d'` | Không | Thời hạn hiệu lực của JWT token |
| `CORS_ORIGIN` | `string` | `'http://localhost:5173'` | Không | Danh sách Origin được phép truy cập (phân tách bằng dấu phẩy) |
| `ENABLE_MQTT` | `string` | `'false'` | Không | Bật kết nối tới MQTT Broker khi vận hành cùng phần cứng |
| `MQTT_URL` | `string` | `'mqtt://localhost:1883'`| Không | Địa chỉ máy chủ MQTT Broker |
| `MQTT_USERNAME` | `string` | `''` | Không | Tài khoản đăng nhập MQTT Broker |
| `MQTT_PASSWORD` | `string` | `''` | Không | Mật khẩu đăng nhập MQTT Broker |
| `MQTT_DEVICE_SECRET` | `string` | — | **Có** | Khóa bí mật xác thực gói tin từ thiết bị Edge AIoT (≥32 ký tự) |
| `BIOMETRIC_ENCRYPTION_KEY` | `string` | — | **Có** | Khóa mã hóa bảo vệ vector sinh trắc học (≥32 ký tự) |
| `FACE_AUTH_URL` | `string` | `'http://localhost:5000'` | Không | URL dịch vụ AI Face Authentication (FastAPI/Python) |
| `FACE_AUTH_TIMEOUT_MS` | `number` | `30000` | Không | Giới hạn thời gian chờ trích xuất vector khuôn mặt (ms) |
| `FACE_MATCH_THRESHOLD` | `number` | `0.45` | Không | Ngưỡng khoảng cách Cosine tối đa để công nhận trùng khớp |
| `TB_HOST` | `string` | `''` | Không | Địa chỉ máy chủ ThingsBoard IoT Server |
| `TB_HTTP_PORT` | `string` | `'8080'` | Không | Cổng HTTP của ThingsBoard Server |
| `TB_DEVICE_TOKEN` | `string` | `''` | Không | Access Token của thiết bị trên ThingsBoard |
| `SMTP_HOST` | `string` | `'smtp.gmail.com'` | Không | Máy chủ SMTP gửi email |
| `SMTP_PORT` | `number` | `587` | Không | Cổng kết nối SMTP |
| `SMTP_USER` | `string` | `''` | Không | Tài khoản email gửi thông báo hệ thống |
| `SMTP_PASS` | `string` | `''` | Không | Mật khẩu ứng dụng (App Password) của tài khoản email |
| `SMTP_FROM` | `string` | `...` | Không | Tên hiển thị người gửi email |

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu Cầu Tiên Quyết
- **Node.js**: Phiên bản $\ge 20.0.0$
- **PostgreSQL**: Phiên bản $\ge 16$ (đã kích hoạt extension `pgvector`)
- **NPM**: Đi kèm với Node.js

### 2. Cài Đặt Thư Viện
```bash
cd backend
npm install
```

### 3. Cấu Hình Biến Môi Trường
Tạo file cấu hình `.env` từ file mẫu:
```bash
cp .env.example .env
```
Cập nhật chuỗi kết nối `DATABASE_URL` và các khóa bảo mật `JWT_SECRET`, `MQTT_DEVICE_SECRET`, `BIOMETRIC_ENCRYPTION_KEY`.

### 4. Đồng Bộ Cơ Sở Dữ Liệu & Dữ Liệu Mẫu
```bash
# Áp dụng các bản migration vào cơ sở dữ liệu
npm run prisma:migrate

# Sinh bộ TypeScript Client SDK cho Prisma
npm run prisma:generate

# Nạp dữ liệu khởi tạo đầy đủ (Phòng ban, Chức vụ, Tài khoản, Phân ca, Chấm công mẫu)
npm run prisma:seed:all
```

### 5. Khởi Chạy Ứng Dụng
```bash
# Chạy môi trường phát triển (tự động reload khi sửa mã nguồn)
npm run dev

# Thực thi toàn bộ bộ kiểm thử tự động
npm test

# Biên dịch mã nguồn cho môi trường Production
npm run build

# Khởi chạy dịch vụ Production từ thư mục dist/
npm start
```

---

## 📜 Danh Sách Lệnh NPM Scripts

| Lệnh Script | Mô tả chức năng |
| :--- | :--- |
| `npm run dev` | Khởi chạy máy chủ phát triển với `tsx watch src/server.ts` |
| `npm run build` | Biên dịch toàn bộ mã nguồn TypeScript sang thư mục `dist/` |
| `npm start` | Chạy ứng dụng production từ file đã biên dịch (`node dist/server.js`) |
| `npm test` | Thực thi bộ kiểm thử tự động với `vitest run` |
| `npm run prisma:generate` | Biên dịch sinh lại bộ TypeScript Client cho Prisma |
| `npm run prisma:migrate` | Áp dụng toàn bộ migrations vào database (`prisma migrate deploy`) |
| `npm run prisma:seed` | Nạp dữ liệu Master Data ban đầu (Phòng ban, Chức vụ, Người dùng, Thiết bị) |
| `npm run prisma:seed:shifts` | Nạp dữ liệu phân ca làm việc mẫu |
| `npm run prisma:seed:attendance` | Nạp dữ liệu nhật ký chấm công mẫu |
| `npm run prisma:seed:all` | Chạy liên hoàn toàn bộ 3 bước Seeding tự động |
| `npm run prisma:studio` | Mở giao diện Web quản trị dữ liệu trực quan Prisma Studio |
