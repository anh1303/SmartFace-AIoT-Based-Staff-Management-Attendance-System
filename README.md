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
│  - Biometric Engine (pgvector 512-D ArcFace Cosine Index)                     │
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
├── run.sh                    # ⚡ Script tự động khởi chạy 1-click cho macOS (và Linux)
├── .gitignore                # Cấu hình GitIgnore (loại trừ node_modules, build, cache, dataset)
├── backend/                  # Phân hệ Máy chủ REST API & CSDL (Node.js, Express, Prisma)
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
├── face_auth/                # Phân hệ AI Sinh trắc học & Edge Camera (Python, InsightFace, PAD)
│   ├── api_service.py        # Dịch vụ FastAPI nội bộ (:5000) trích xuất 512-D Embeddings & DB sync
│   ├── app.py                # Ứng dụng Camera Edge AIoT nhận diện & chống giả mạo thời gian thực
│   ├── config.py             # Cấu hình ngưỡng nhận diện, ArcFace, SCRFD/YunNet, PAD models
│   ├── alignment/            # Căn chỉnh khuôn mặt 5 điểm chuẩn (Similarity Transform)
│   ├── antispoof/            # Mô hình PAD chống giả mạo (MobileNetV3-Small E1 v5.3, 2D-DCT, E3)
│   ├── database/             # Kết nối PostgreSQL pgvector (Connection Pool, Cosine Distance)
│   ├── detection/            # Bộ phát hiện khuôn mặt (SCRFD / YunNet)
│   ├── enrollment/           # Thuật toán tính Centroid embedding đại diện & lọc outlier
│   ├── evaluation/           # Benchmarks, đánh giá độ chính xác nhận diện & LFW calibration
│   ├── tracking/             # Bộ theo dõi khuôn mặt IOU Tracker đa mục tiêu
│   └── README.md             # 📖 Tài liệu chi tiết phân hệ Face Authentication & AIoT Biometrics
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

## 📋 Yêu Cầu Tiên Quyết (Prerequisites)

Trước khi khởi chạy dự án, máy tính cần cài đặt sẵn:
1. **Git**: Dùng để tải mã nguồn (`git clone`).
2. **Node.js**: Phiên bản **v20+** hoặc **v22+ LTS** (kèm theo trình quản lý gói `npm`).
3. **Cơ sở Dữ liệu PostgreSQL 16 + `pgvector`**:
   - **Cách 1 (Neon Cloud — Khuyên dùng)**: Sử dụng [Neon Serverless PostgreSQL](https://neon.tech/) tích hợp sẵn `pgvector`, không tốn tài nguyên máy và dễ dàng deploy toàn cầu.
   - **Cách 2 (Docker Compose Cục bộ)**: Khởi chạy PostgreSQL + `pgvector` qua Docker Desktop (`docker compose --env-file .env.compose --profile tools up -d`).
4. **Python**: Phiên bản **3.10** hoặc **3.11** (dành cho phân hệ AI Face Authentication).

---

## ⚡ Hướng Dẫn Cài Đặt & Khởi Chạy

Hướng dẫn đầy đủ Docker profile `app`, Prisma migration/seed, enroll gallery và
xóa danh tính test: [docs/run_full_stack.md](docs/run_full_stack.md).
Kết quả kiểm chứng tích hợp: [docs/face_auth_verification_2026-10-01.md](docs/face_auth_verification_2026-10-01.md).

### 🟢 Cách 1: Tự động khởi chạy bằng 1-Click Script (Khuyên dùng)

Dự án cung cấp script menu để tạo file `.env` mẫu nếu thiếu, cài dependencies Node, khởi chạy Docker database và mở Face Auth API, Backend, Frontend trong các cửa sổ riêng. Cài requirements Python trước khi dùng launcher.

- **Trên Windows (`run.bat`)**:
  ```cmd
  .\run.bat
  ```
- **Trên macOS / Linux (`run.sh`)**:
  ```bash
  chmod +x run.sh
  ./run.sh
  ```
  *(Trên macOS, `run.sh` sử dụng AppleScript để mở 3 cửa sổ Terminal.app: Face Auth API `5000`, Backend `3000` và Frontend `5173`; `run.bat` mở 3 cửa sổ trên Windows.)*

#### Quy trình thao tác lần đầu tiên sau khi clone:
1. **Nhập `[6]`**: Tự động tạo `.env` nếu thiếu và chạy `npm install` cho cả Backend và Frontend.
   Cài Python dependencies: `cd face_auth` rồi `python3 -m pip install -r requirements.txt` (Windows dùng `python`). Có thể dùng virtualenv `face_auth/.venv`.
2. **Cấu hình `.env.compose`**: Điền đúng tên volume PostgreSQL PBL6 hiện có và mật khẩu đang dùng; script không tự tạo volume database mới.
3. **Nhập `[5]`**: Khởi động PostgreSQL + pgAdmin bằng cấu hình Docker Compose chung.
4. **Nhập `[7]`**: Chạy `prisma:generate` và `prisma:migrate`, không seed dữ liệu.
5. **Nhập `[1]`**: Mở Face Auth API, Backend và Frontend; camera realtime chạy riêng bằng `python3 app.py` trong `face_auth`.
> 💡 *Các lần tiếp theo, bạn chỉ cần mở script và nhập **`[1]`** để khởi động toàn bộ!*

---

### 🟡 Cách 2: Khởi chạy thủ công từng bước (Cross-Platform: Windows / Linux / macOS)

#### Bước 1: Tạo các file biến môi trường (`.env`)
> [!IMPORTANT]
> Vì lý do bảo mật, file `.env` được loại trừ trong `.gitignore`. Bạn cần tạo file `.env` cho cả Backend và Frontend trước khi khởi chạy.

- **Cho Backend**:
  - Windows PowerShell: `Copy-Item backend/.env.example backend/.env`
  - Windows CMD: `copy backend\.env.example backend\.env`
  - Linux / macOS / Git Bash: `cp backend/.env.example backend/.env`

- **Cho Frontend**:
  - Windows PowerShell: `Copy-Item frontend/.env.example frontend/.env`
  - Windows CMD: `copy frontend\.env.example frontend\.env`
  - Linux / macOS / Git Bash: `cp frontend/.env.example frontend/.env`

- **Cho Docker**: Sao chép `.env.compose.example` thành `.env.compose`; đặt
  đúng tên volume PostgreSQL PBL6 hiện có và mật khẩu hiện tại. Nếu Face Auth
  chạy trên máy khác, cấu hình bind IP trong `.env.compose` và `POSTGRES_HOST`
  theo địa chỉ LAN của máy chủ DB, đồng thời giới hạn port bằng firewall.

#### Bước 2: Khởi động Cơ sở dữ liệu qua Docker
```bash
docker compose --env-file .env.compose --profile tools up -d
```
*Một PostgreSQL + pgvector dùng chung khởi chạy tại port `5432`; pgAdmin tại port `5050`.*
*Trước khi chạy, `.env.compose` phải trỏ đến volume PBL6 hiện có và dùng mật khẩu đúng với database đó. Migration xóa embeddings khuôn mặt cũ nhưng giữ các bảng nghiệp vụ khác. Không chạy `npm run prisma:seed` trên database đang sử dụng vì seed xóa dữ liệu trước khi nạp lại.*

#### Bước 3: Cấu hình, Migrate & Khởi chạy Backend
```bash
cd backend
# 1. Cài đặt dependencies
npm install

# 2. Sinh Prisma Client
npm run prisma:generate

# 3. Áp dụng các migration đã commit & Kích hoạt extension pgvector
npm run prisma:migrate

# Không chạy seed trên database đang sử dụng; seed xóa dữ liệu trước khi nạp mẫu.

# 4. Khởi chạy Backend server
npm run dev
# Backend lắng nghe tại: http://localhost:3000
```

#### Bước 4: Cài đặt & Khởi chạy Frontend (Mở Terminal thứ 2)
```bash
cd frontend
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy Vite Dev Server
npm run dev
# Ứng dụng web truy cập tại: http://localhost:5173
```

---

### 🛠️ Bảng Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Lỗi thường gặp | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Máy tính đã cài sẵn PostgreSQL chạy dịch vụ ngầm trên Windows | Mở **Services** (`services.msc`) $\rightarrow$ Tìm service `postgresql-x64-...` $\rightarrow$ Chuột phải chọn **Stop**. Sau đó chạy lại `docker compose up -d`. |
| `error: open \\.\pipe\docker_engine: The system cannot find the file specified` | Ứng dụng Docker Desktop chưa được bật | Khởi động ứng dụng Docker Desktop trên máy và đợi biểu tượng chuyển sang màu xanh lá (*Engine running*) rồi thử lại. |
| `❌ Invalid environment variables: DATABASE_URL is required...` | Chưa tạo file `backend/.env` hoặc chuỗi Secret quá ngắn | Đảm bảo đã sao chép từ `backend/.env.example` thành `backend/.env`. Các khóa `JWT_SECRET`, `BIOMETRIC_ENCRYPTION_KEY` bắt buộc phải $\ge 32$ ký tự. |
| `extension "vector" is not available` | Đang kết nối tới PostgreSQL thông thường không có pgvector | Bắt buộc phải chạy PostgreSQL thông qua Docker Compose của dự án (`pgvector/pgvector:pg16`). |
| Không lưu phiên đăng nhập hoặc bị đăng xuất ngay | Xung đột cổng kết nối hoặc chặn Cookie | Đảm bảo Frontend chạy đúng cổng `5173` và Backend chạy cổng `3000` để các cookie `HttpOnly; SameSite` hoạt động chuẩn xác theo cấu hình CORS. |

---

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

### 1. Phân Hệ Backend REST API (`http://localhost:3000`)

| Phương thức | Đường dẫn API | Mô tả chức năng | Quyền yêu cầu |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Đăng nhập tài khoản, thiết lập HttpOnly Cookie | Public |
| `POST` | `/api/auth/logout` | Đăng xuất và hủy Cookie phiên làm việc | Authenticated |
| `GET` | `/api/auth/me` | Lấy thông tin tài khoản đang đăng nhập | Authenticated |
| `POST` | `/api/auth/register` | Đăng ký tài khoản người dùng mới | `ADMIN` |
| `GET` | `/api/employees` | Lấy danh sách nhân viên (phân trang, lọc chức vụ, tìm kiếm) | `MANAGER`, `ADMIN` |
| `POST` | `/api/employees` | Thêm mới hồ sơ nhân viên | `MANAGER`, `ADMIN` |
| `PUT` | `/api/employees/:id` | Cập nhật thông tin nhân viên | `MANAGER`, `ADMIN` |
| `DELETE` | `/api/employees/:id` | Xóa nhân viên khỏi hệ thống | `ADMIN` |
| `GET` | `/api/attendance` | Lấy danh sách nhật ký chấm công (nhân viên xem của mình) | Authenticated |
| `GET` | `/api/attendance/statistics` | Thống kê số lượt check-in hôm nay, thiết bị active | Authenticated |
| `POST` | `/api/attendance/check-in` | Ghi nhận sự kiện chấm công vào (gương mặt / vân tay) | Authenticated |
| `POST` | `/api/attendance/check-out` | Ghi nhận sự kiện chấm công ra | Authenticated |
| `GET` | `/api/attendance/summaries` | Lấy dữ liệu tổng hợp chấm công ngày (`daily_attendance_summary`) | Authenticated |
| `PATCH` | `/api/attendance/adjust` | Hiệu chỉnh thủ công giờ trễ/sớm và OT của nhân viên | `MANAGER`, `ADMIN` |
| `GET` | `/api/attendance/locks` | Tra cứu danh sách trạng thái chốt ca theo ngày | Authenticated |
| `POST` | `/api/attendance/locks/lock` | Khóa chốt dữ liệu chấm công của ngày được chọn | `MANAGER`, `ADMIN` |
| `POST` | `/api/attendance/locks/unlock` | Mở khóa chỉnh sửa dữ liệu chấm công | `MANAGER`, `ADMIN` |
| `POST` | `/api/attendance/aggregate` | Tổng hợp công ngày theo tháng/năm (`Decimal(5,2)` giờ) | `MANAGER`, `ADMIN` |
| `GET` | `/api/shifts` | Danh sách ca làm việc và lịch phân ca | Authenticated |
| `POST` | `/api/shifts` | Phân công ca làm việc cho nhân viên | `MANAGER`, `ADMIN` |
| `GET` | `/api/payroll` | Lấy bảng lương theo kỳ (`payroll_period: YYYY-MM`) | Authenticated |
| `POST` | `/api/payroll/generate` | Tự động tính toán bảng lương tháng theo giờ công | `MANAGER`, `ADMIN` |
| `PUT` | `/api/payroll/:id` | Cập nhật thông số phiếu lương cá nhân | `MANAGER`, `ADMIN` |
| `POST` | `/api/payroll/period/:period/finalize` | Chốt sổ bảng lương kỳ được chọn | `MANAGER`, `ADMIN` |
| `POST` | `/api/payroll/period/:period/unlock` | Mở khóa lại bảng lương đã chốt | `ADMIN` |
| `GET` | `/api/payroll/bonus-penalty` | Lấy quy định chính sách thưởng/phạt | Authenticated |
| `PUT` | `/api/payroll/bonus-penalty` | Cập nhật chính sách thưởng OT & phạt đi trễ | `MANAGER`, `ADMIN` |
| `GET` | `/api/biometrics/:employeeId` | Lấy thông tin vector gương mặt đã đăng ký | Authenticated |
| `POST` | `/api/biometrics/:employeeId` | Đăng ký vector khuôn mặt 512-D sinh trắc mới | `MANAGER`, `ADMIN` |
| `POST` | `/api/biometrics/:employeeId/enroll-images` | Gửi ảnh base64 qua Face Auth service để trích xuất vector | `MANAGER`, `ADMIN` |
| `DELETE` | `/api/biometrics/:employeeId` | Xóa dữ liệu sinh trắc học của nhân viên | `MANAGER`, `ADMIN` |
| `GET` | `/api/devices` | Danh sách và trạng thái các thiết bị AIoT | Authenticated |
| `POST` | `/api/devices` | Thêm mới thiết bị AIoT | `MANAGER`, `ADMIN` |
| `PUT` | `/api/devices/:id` | Cập nhật thông tin thiết bị AIoT | `MANAGER`, `ADMIN` |
| `DELETE` | `/api/devices/:id` | Xóa thiết bị AIoT | `ADMIN` |
| `GET` | `/api/audit-logs` | Xem nhật ký kiểm toán thao tác hệ thống | `ADMIN` |

### 2. Phân Hệ Face Auth Internal API (`http://localhost:5000`)

| Phương thức | Đường dẫn API | Mô tả chức năng | Quyền yêu cầu |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Kiểm tra trạng thái hoạt động & phiên bản embedding | Nội bộ / Backend |
| `POST` | `/internal/enroll` | Trích xuất 512-D ArcFace embedding từ ảnh base64, tính Centroid & lưu pgvector | Nội bộ / Backend |
| `DELETE` | `/internal/enroll/:employee_code` | Xóa toàn bộ vector khuôn mặt trong CSDL theo mã nhân viên | Nội bộ / Backend |

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
