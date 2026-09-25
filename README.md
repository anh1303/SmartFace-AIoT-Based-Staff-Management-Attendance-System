# 🛡️ SmartFace: AIoT-Based Staff Management & Attendance System

> **SmartFace** là Hệ thống Quản lý Nhân sự & Giám sát Chấm công Thông minh ứng dụng công nghệ **AIoT (Artificial Intelligence of Things)**. Nền tảng kết hợp xác thực sinh trắc học gương mặt qua Edge AI Camera, cơ chế chống giả mạo khuôn mặt **PAD (Presentation Attack Detection)**, điểm danh vân tay dự phòng (**Fingerprint Fallback**), cùng hệ thống tự động tính lương (**Payroll Engine**) theo giờ công thực tế và giám sát thời gian thực qua **WebSockets (Socket.IO)** & **MQTT**.

---

## 🏷️ Badges & Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-v20+-339933.svg?style=flat-square&logo=nodedotjs)
![React](https://img.shields.io/badge/React-v19.0-61DAFB.svg?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.8-3178C6.svg?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1.svg?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-v5.20-2D3748.svg?style=flat-square&logo=prisma)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5-FF4154.svg?style=flat-square&logo=reactquery)
![Vite](https://img.shields.io/badge/Vite-v6.2-646CFF.svg?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-06B6D4.svg?style=flat-square&logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?style=flat-square&logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

---

## 🏗️ Kiến Trúc Hệ Thống (System Architecture)

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                          AIoT EDGE DEVICES / SENSORS                          │
│  - FaceCam-01: Edge AI Camera Vào ca (YOLO Detection + MobileNetV3 PAD + ArcFace)│
│  - FaceCam-02: Edge AI Camera Tan ca (YOLO Detection + MobileNetV3 PAD + ArcFace)│
│  - Fingerprint-01: Máy chấm công vân tay Vào ca (Optical Sensor / ESP32 Node)  │
│  - Fingerprint-02: Máy chấm công vân tay Tan ca (Optical Sensor / ESP32 Node)  │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │ MQTT Protocols / REST API
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND SERVICE (Node.js)                           │
│  - RESTful API Gateway (Express.js + Zod DTO Validation)                      │
│  - Real-time Gateway (Socket.IO với JWT Cookie Handshake Auth & MQTT Client)   │
│  - Security Layer (HttpOnly JWT Cookie Auth, RBAC: ADMIN/MANAGER/EMPLOYEE)    │
│  - Biometric Engine (pgvector 512-D ArcFace Cosine Index, AES-256 Encryption)  │
│  - Business Services (Attendance, Employee, Shift Scheduling, Payroll, Audit) │
└───────────────────────┬─────────────────────────────────┬─────────────────────┘
                        │                                 │
                        ▼ Prisma ORM (5.20)               ▼ WebSocket Stream
┌──────────────────────────────────────┐        ┌──────────────────────────────┐
│           DATABASE LAYER             │        │      FRONTEND APPLICATION    │
│  - PostgreSQL 16 (Quan hệ & ACID)    │        │  - React 19 + TypeScript     │
│  - pgvector (Vector Embeddings 512D) │        │  - Vite + Tailwind CSS v4    │
│  - HNSW Index Cosine Similarity      │        │  - TanStack Query v5 Cache   │
│  - 14 Bảng dữ liệu chuẩn hóa         │        │  - Recharts & Lucide Icons   │
│  - Múi giờ Việt Nam (Asia/Ho_Chi_Minh│        │  - Dark Theme & Responsive   │
└──────────────────────────────────────┘        └──────────────────────────────┘
```

---

## 📁 Cấu Trúc Thư Mục Dự Án (Project Layout)

```text
SmartFace-AIoT-Based-Staff-Management-Attendance-System/
├── run.bat                   # ⚡ Script tự động khởi chạy 1-click cho Windows
├── .gitignore                # Cấu hình GitIgnore (đã loại trừ node_modules, build, __tests__/)
├── backend/                  # Phân hệ Máy chủ & CSDL (Node.js, Express, Prisma)
│   ├── docker-compose.yml    # Docker Compose khởi chạy PostgreSQL 16 & pgAdmin4
│   ├── prisma/               # Quản lý Database Schema, Migrations & Dữ liệu Seed
│   │   ├── schema.prisma     # 14 Models CSDL chuẩn hóa (kèm attendance_locks, pgvector)
│   │   ├── seed.ts           # Dữ liệu mẫu ban đầu (nhân viên, chức vụ, ca làm, 4 thiết bị)
│   │   └── README.md         # 📖 Tài liệu chuyên sâu Database & Prisma
│   ├── src/                  # Mã nguồn Backend
│   │   ├── common/           # Tiện ích dùng chung, AppError, Response DTO, Constants
│   │   ├── config/           # Cấu hình Database (Prisma), Env (Zod), MQTT Broker
│   │   ├── middlewares/      # Xác thực JWT Cookie, phân quyền RBAC, validate DTO
│   │   ├── modules/          # Các module nghiệp vụ (attendance, auth, biometrics, 
│   │   │                     # devices, employees, payroll, shifts, audit-logs)
│   │   ├── sockets/          # Socket.IO Gateway (giám sát chấm công & thiết bị thời gian thực)
│   │   └── server.ts         # Khởi tạo HTTP server, tích hợp Socket.IO & MQTT
│   └── README.md             # 📖 Tài liệu chi tiết phân hệ Backend & REST API
├── frontend/                 # Phân hệ Giao diện Người dùng (React 19, Vite, Tailwind CSS v4)
│   ├── src/
│   │   ├── api/              # HTTP Client (Axios/Fetch), Auth, Employee, Attendance, Payroll APIs
│   │   ├── components/       # Components dùng chung (Modal, Toast, AppLayout, Sidebar, Topbar)
│   │   ├── context/          # React Context (AuthContext với HttpOnly Cookie, ToastContext)
│   │   ├── features/         # Features module (attendance-monitor: Table, Filters, CSV Export)
│   │   ├── hooks/            # Custom hooks tích hợp TanStack React Query v5
│   │   ├── pages/
│   │   │   ├── manager/      # Dành cho Quản lý (Dashboard, Giám sát chấm công, Nhân viên,
│   │   │   │                 # Lập lịch ca, Sinh trắc học, Bảng lương, Báo cáo thống kê)
│   │   │   ├── staff/        # Cổng nhân viên (Dashboard cá nhân, Điểm danh, Lịch làm, Ước tính lương, Hồ sơ)
│   │   │   └── public/       # Trang công khai (Landing Page, Trang đăng nhập)
│   │   ├── types/            # Khai báo kiểu TypeScript toàn dự án
│   │   └── utils/            # Chuẩn hóa múi giờ Việt Nam (+07:00), định dạng tiền tệ VND
│   └── README.md             # 📖 Tài liệu chi tiết phân hệ Frontend
└── README.md                 # Tài liệu tổng quan toàn hệ thống (File này)
```

---

## 🔑 Tài Khoản Đăng Nhập & Dữ Liệu Mẫu

Hệ thống được khởi tạo sẵn với bộ dữ liệu mẫu đầy đủ sau khi thực hiện Seed (`npm run prisma:seed`):

- **Mật khẩu dùng chung cho mọi tài khoản mẫu**: **`Admin@123456`**

| Tài khoản (Username) | Phân quyền (Role) | Chức năng truy cập | Nhân viên liên kết |
| :--- | :--- | :--- | :--- |
| **`admin`** | `ADMIN` | Toàn quyền quản trị hệ thống, quản lý thiết bị, phân quyền | Quản trị viên hệ thống |
| **`manager`** | `MANAGER` | Giám sát chấm công, lập lịch ca, tính lương, duyệt báo cáo | Nguyễn Văn A (`NV-001`) |
| **`employee`** | `EMPLOYEE` | Xem lịch làm việc cá nhân, lịch sử điểm danh, ước tính lương | Lê Hoàng Phúc (`NV-002`) |

### 🏢 Danh Sách 4 Chức Vụ Chuẩn Hóa
Hệ thống sử dụng đồng bộ thuật ngữ **Chức vụ** (thay cho Phòng ban) trên toàn bộ bảng và giao diện:
1. **Quản lý** (`Code: Manager`)
2. **Thu ngân** (`Code: Cashier`)
3. **Nhân viên** (`Code: Staff`)
4. **Bảo vệ** (`Code: Security`)

### ⏰ Danh Sách 3 Ca Làm Việc Mẫu (`work_shifts`)
1. **Full time**: `08:00 - 18:00`
2. **Part time: Ca sáng**: `08:00 - 12:00`
3. **Part time: Ca chiều**: `13:00 - 18:00`
> 💡 *Thời gian ân hạn (Grace Period): **15 phút**. Check-in sau giờ bắt đầu ca + 15 phút được tính là **Đi trễ** (`LATE`). Check-out trước giờ kết thúc ca được tính là **Về sớm** (`EARLY_LEAVE`).*

### 📡 Danh Sách 4 Thiết Bị AIoT Chuẩn Hóa (`devices`)
Hệ thống kết nối và hiển thị trạng thái thời gian thực của 4 thiết bị AIoT chuyên trách:
1. **`FaceCam-01`**: Camera AI nhận diện Face-ID Vào ca (Cổng vào, IP: `192.168.1.101`)
2. **`FaceCam-02`**: Camera AI nhận diện Face-ID Tan ca (Cổng ra, IP: `192.168.1.102`)
3. **`Fingerprint-01`**: Máy quét vân tay Vào ca (Cửa chính, IP: `192.168.1.103`)
4. **`Fingerprint-02`**: Máy quét vân tay Tan ca (Cửa ra, IP: `192.168.1.104`)

---

## ⚡ Hướng Dẫn Cài Đặt & Khởi Chạy Nhanh

### 🟢 Cách 1: Tự động khởi chạy bằng `run.bat` (Khuyên dùng trên Windows)

1. Mở Terminal / Command Prompt tại thư mục gốc của dự án:
   ```cmd
   .\run.bat
   ```
2. Menu tương tác hiển thị cho phép bạn chọn nhanh:
   - **`[1]`**: Khởi động toàn bộ: Bật Docker Container (PostgreSQL + pgAdmin) và khởi chạy đồng thời Backend (Port 3000) & Frontend (Port 5173).
   - **`[2]`**: Chỉ chạy Backend & Frontend (khi Database đã đang chạy sẵn).
   - **`[5]`**: Khởi động Docker Database.
   - **`[6]`**: Cài đặt `npm install` tự động cho cả Backend và Frontend.
   - **`[7]`**: Chạy `prisma migrate` và nạp dữ liệu mẫu (`seed`).

---

### 🟡 Cách 2: Khởi chạy thủ công từng bước

#### 1. Khởi động Cơ sở dữ liệu (PostgreSQL 16)
```bash
cd backend
docker compose up -d
```
*PostgreSQL khởi chạy tại port `5432`, pgAdmin khởi chạy tại port `5050`.*

#### 2. Cấu hình & Chạy Backend
```bash
cd backend
# 1. Cài đặt dependencies
npm install

# 2. Tạo biến môi trường từ mẫu
cp .env.example .env

# 3. Đồng bộ cấu trúc Database & Nạp dữ liệu mẫu
npm run prisma:migrate
npm run prisma:seed

# 4. Khởi chạy Backend server
npm run dev
# Backend lắng nghe tại: http://localhost:3000
```

#### 3. Cấu hình & Chạy Frontend
```bash
cd ../frontend
# 1. Cài đặt dependencies
npm install

# 2. Tạo biến môi trường từ mẫu
cp .env.example .env

# 3. Khởi chạy Vite Dev Server
npm run dev
# Ứng dụng web truy cập tại: http://localhost:5173
```

---

## ✨ Tính Năng Nghiệp Vụ Chính

### 1. Giám Sát Chấm Công Toàn Diện Thời Gian Thực
- **Bảng theo dõi chấm công khoa học (10 cột chuẩn)**: Nhân viên, Ca làm việc, Sự kiện (Vào ca/Hết ca), Thời gian, Phương thức (Face-ID/Vân tay), Độ tin cậy (%), Trạng thái, Trễ/Sớm, Tăng ca (OT), Thao tác chỉnh sửa.
- **Tính năng Chốt ca điểm danh (`attendance_locks`)**: Quản lý có thể chốt số liệu điểm danh theo từng ngày. Sau khi chốt ca, dữ liệu được khóa an toàn và cho phép **Xuất Báo cáo CSV/Excel** chuẩn UTF-8 có dấu.
- **Hiệu chỉnh thủ công an toàn**: Cho phép quản lý điều chỉnh giờ trễ/sớm và OT khi nhân viên có lý do chính đáng, tự động ghi vết vào bảng kiểm toán `audit_logs`.

### 2. Sinh Trắc Học Kép AIoT (Gương Mặt & Vân Tay)
- **Face Recognition**: Sử dụng mô hình nhận diện khuôn mặt trích xuất vector 512 chiều (ArcFace) lưu trữ trong PostgreSQL bằng extension `pgvector`, so khớp khoảng cách Cosine nhanh chóng qua chỉ mục HNSW.
- **PAD (Chống giả mạo)**: Tích hợp cơ chế phát hiện giả mạo khuôn mặt không cho phép điểm danh bằng ảnh chụp, video phát lại trên điện thoại/máy tính bảng.
- **Fingerprint Fallback**: Điểm danh dự phòng bằng cảm biến vân tay quang học khi nhân viên đeo khẩu trang hoặc môi trường ánh sáng yếu.

### 3. Động Cơ Tính Lương Chuẩn Xác (Payroll Engine)
- Tính toán lương tập trung tại Backend (`payroll.service.ts`) dựa trên dữ liệu tổng hợp giờ làm thực tế:
  $$\text{Lương thực nhận (Net Salary)} = (\text{Tổng giờ làm thực tế} \times \text{Lương giờ}) + \text{Thưởng OT} - \text{Phạt đi trễ/về sớm} + \text{Phụ cấp}$$
- **Chuẩn hóa đơn vị Giờ (`Decimal(5,2)`)**: Mọi chỉ số `total_working_hours`, `late_early`, `overtime` được làm tròn theo nấc 0.5 giờ (30 phút).
- Hệ số thưởng OT mặc định: **100.000 ₫/giờ**. Phạt trễ/về sớm mặc định: **50.000 ₫/giờ**. Phụ cấp mặc định: **1.500.000 ₫**.
- Quản lý có thể tạo bảng lương theo tháng (`YYYY-MM`), duyệt và cập nhật trạng thái chi trả (`PENDING` $\rightarrow$ `PAID`).

### 4. Lập Lịch & Phân Ca Làm Việc
- Phân ca linh hoạt theo tuần cho từng nhân viên hoặc theo chức vụ.
- Hỗ trợ cả ca cố định (`Full time`) và ca bán thời gian (`Part time Ca sáng / Ca chiều`).
- Dữ liệu phân ca được dùng làm căn cứ tự động xác định tính đúng giờ (Punctuality) cho các lần quẹt thẻ.

### 5. Cổng Tự Phục Vụ Dành Cho Nhân Viên (Staff Portal)
- Nhân viên đăng nhập tra cứu tức thì:
  - Thông tin ca làm việc trong ngày và lịch làm việc cả tuần.
  - Lịch sử chấm công chi tiết kèm ảnh chụp/phương thức và độ tin cậy.
  - **Ước tính thu nhập tạm tính**: Tính trước thu nhập thực tế trong tháng theo giờ công đã tích lũy.
  - Xem và tải phiếu lương các tháng trước.

---

## 🔒 Kiến Trúc Bảo Mật & Chuẩn Hóa Dữ Liệu

1. **Xác thực JWT an toàn qua HttpOnly Cookie**:
   - Token xác thực được lưu trữ trong Cookie với các cờ `HttpOnly; Secure; SameSite=Strict`, ngăn chặn hoàn toàn các cuộc tấn công đánh cắp phiên qua XSS.
2. **Phân quyền người dùng (Role-Based Access Control - RBAC)**:
   - Middleware `authenticateToken` và `authorizeRole('ADMIN', 'MANAGER')` kiểm soát chặt chẽ từng route API.
3. **Mã hóa dữ liệu nhạy cảm**:
   - Mật khẩu người dùng được băm an toàn bằng thuật toán **Bcrypt** với salt round 10.
   - Vector sinh trắc học khuôn mặt được bảo vệ trong tầng cơ sở dữ liệu.
4. **Nhật ký kiểm toán (`audit_logs`)**:
   - Mọi thao tác trọng yếu (sửa chấm công, chốt ca, tạo bảng lương, thêm/sửa nhân viên) đều tự động ghi lại IP, User thực hiện, thời gian, giá trị cũ (`old_values`) và giá trị mới (`new_values`).
5. **Chuẩn hóa múi giờ Việt Nam (+07:00)**:
   - Toàn bộ backend và frontend xử lý ngày giờ qua timezone `Asia/Ho_Chi_Minh` (`en-CA`), triệt tiêu hoàn toàn lỗi lệch lùi 1 ngày do UTC vào khung giờ nửa đêm (00:00 - 06:59 AM).

---

## 📡 API Reference Tóm Tắt

| Phương thức | Đường dẫn API | Mô tả chức năng | Quyền yêu cầu |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Đăng nhập tài khoản, thiết lập HttpOnly Cookie | Public |
| `POST` | `/api/v1/auth/logout` | Đăng xuất và hủy Cookie phiên làm việc | Authenticated |
| `GET` | `/api/v1/auth/me` | Lấy thông tin tài khoản đang đăng nhập | Authenticated |
| `GET` | `/api/v1/employees` | Lấy danh sách nhân viên (phân trang, lọc chức vụ, tìm kiếm) | Authenticated |
| `POST` | `/api/v1/employees` | Thêm mới hồ sơ nhân viên | `MANAGER`, `ADMIN` |
| `PUT` | `/api/v1/employees/:id` | Cập nhật thông tin nhân viên | `MANAGER`, `ADMIN` |
| `DELETE` | `/api/v1/employees/:id` | Xóa nhân viên khỏi hệ thống | `MANAGER`, `ADMIN` |
| `GET` | `/api/v1/attendance/logs` | Lấy danh sách sự kiện quẹt thẻ chấm công | Authenticated |
| `POST` | `/api/v1/attendance/check-in` | Ghi nhận sự kiện chấm công từ Edge Device | Device / System |
| `GET` | `/api/v1/attendance/summaries` | Lấy dữ liệu tổng hợp chấm công ngày (`daily_attendance_summary`) | Authenticated |
| `POST` | `/api/v1/attendance/adjust` | Hiệu chỉnh thủ công giờ trễ/sớm và OT của nhân viên | `MANAGER`, `ADMIN` |
| `GET` | `/api/v1/attendance/lock-status` | Tra cứu trạng thái chốt ca theo ngày | Authenticated |
| `POST` | `/api/v1/attendance/toggle-lock` | Bật / tắt chốt số liệu ca làm việc theo ngày | `MANAGER`, `ADMIN` |
| `GET` | `/api/v1/shifts` | Danh sách ca làm việc định nghĩa sẵn | Authenticated |
| `GET` | `/api/v1/shifts/assignments` | Lấy lịch phân ca của nhân viên theo tuần | Authenticated |
| `POST` | `/api/v1/shifts/assign` | Phân công ca làm việc cho nhân viên | `MANAGER`, `ADMIN` |
| `GET` | `/api/v1/payroll/records` | Lấy bảng lương theo kỳ (`payroll_period: YYYY-MM`) | Authenticated |
| `POST` | `/api/v1/payroll/generate` | Chốt và tự động tính bảng lương tháng theo giờ công | `MANAGER`, `ADMIN` |
| `PUT` | `/api/v1/payroll/records/:id/status` | Cập nhật trạng thái chi trả lương (`PENDING`/`PAID`) | `MANAGER`, `ADMIN` |
| `GET` | `/api/v1/devices` | Danh sách và trạng thái 4 thiết bị AIoT | Authenticated |
| `GET` | `/api/v1/audit-logs` | Xem nhật ký kiểm toán thao tác hệ thống | `MANAGER`, `ADMIN` |

---

## 🧪 Kiểm Thử Hệ Thống (Automated Testing)

Dự án áp dụng bộ kiểm thử tự động toàn diện trên cả Backend và Frontend:

- **Backend Tests (Vitest)**: Kiểm tra xác thực Cookie, RBAC, phân quyền API, nghiệp vụ chấm công, tính toán lương, tính lũy kế và Idempotency:
  ```bash
  cd backend
  npm run test
  # Kết quả: 37/37 tests passed (100%)
  ```
- **Frontend Tests (Vitest + JSDOM)**: Kiểm tra AuthContext, queryClient cache cleanup, useAttendancePairs Hook, tiện ích thời gian và bộ lọc:
  ```bash
  cd frontend
  npm run test
  # Kết quả: 15/15 tests passed (100%)
  ```
- **Kiểm tra TypeScript & Build Production**:
  ```bash
  cd frontend
  npm run lint   # tsc --noEmit
  npm run build  # vite build: 0 error
  ```

---

## 📄 License

Dự án được phân phối theo giấy phép **MIT License**. Mọi đóng góp và mã nguồn đều tuân thủ các quy định bảo mật sinh trắc học và an toàn dữ liệu cá nhân.
