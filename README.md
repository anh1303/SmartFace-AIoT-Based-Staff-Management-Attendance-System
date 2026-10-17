# 🛡️ SmartFace: AIoT-Based Staff Management & Attendance System

> **SmartFace** là Hệ thống Quản lý Nhân sự & Giám sát Chấm công Toàn diện ứng dụng công nghệ **AIoT (Artificial Intelligence of Things)**. Nền tảng kết hợp nhận diện khuôn mặt thời gian thực qua Edge AI Camera, cơ chế chống giả mạo sinh trắc học **PAD (Presentation Attack Detection)**, điểm danh vân tay dự phòng (**Fingerprint Fallback**), động cơ tính lương tự động (**Payroll Engine**) theo giờ công thực tế, và giám sát vận hành tức thời qua **WebSockets (Socket.IO)** & **MQTT**.

---

## 🏷️ Badges & Tech Stack

![Node.js](https://img.shields.io/badge/Node.js-v20+-339933.svg?style=flat-square&logo=nodedotjs)
![React](https://img.shields.io/badge/React-v19.0-61DAFB.svg?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.8-3178C6.svg?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1.svg?style=flat-square&logo=postgresql)
![pgvector](https://img.shields.io/badge/pgvector-v0.8.6-0064a5.svg?style=flat-square)
![Prisma](https://img.shields.io/badge/Prisma-v5.20-2D3748.svg?style=flat-square&logo=prisma)
![Python](https://img.shields.io/badge/Python-v3.10+-3776AB.svg?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-v0.110+-009688.svg?style=flat-square&logo=fastapi)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5-FF4154.svg?style=flat-square&logo=reactquery)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-06B6D4.svg?style=flat-square&logo=tailwindcss)
![Vite](https://img.shields.io/badge/Vite-v6.2-646CFF.svg?style=flat-square&logo=vite)
![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?style=flat-square&logo=docker)
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

---

## 🗺️ Bản Đồ Tài Liệu Chi Tiết (Documentation Map)

Dự án được tài liệu hóa chuyên sâu cho từng phân hệ độc lập:

| Tài liệu phân hệ | Đường dẫn | Nội dung bao phủ chính |
| :--- | :--- | :--- |
| ⚡ **Backend Service (BE)** | [backend/README.md](backend/README.md) | Kiến trúc Modular Monolith, Luồng xử lý Request Lifecycle, Quy chuẩn REST API, Biến môi trường, Xử lý lỗi toàn cục |
| 🗄️ **Database & Prisma (DB)** | [backend/prisma/README.md](backend/prisma/README.md) | Sơ đồ ERD 15 bảng, Vector 512-D `pgvector` HNSW, Quy trình Migration, Quy trình Seed Data 3 bước, Quy ước đặt tên |
| 🎨 **Frontend Web App (FE)** | [frontend/README.md](frontend/README.md) | Kiến trúc Pragmatic Feature-Based, Quy tắc đặt file, Quản lý State TanStack Query v5 & Context, UI Kit Glassmorphism & Dark Mode |
| 👁️ **Face Auth & AI Engine** | [face_auth/README.md](face_auth/README.md) | Thuật toán ArcFace 512-D, PAD MobileNetV3-Small, Centroid Enrollment, SCRFD / YunNet face detection |
| 🚀 **Hướng Dẫn Triển Khai (A-Z)** | [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Cài đặt môi trường từ A-Z, chạy webcam test local hoặc triển khai thực tế trên Raspberry Pi 4 |
| 🔄 **Sơ Đồ Luồng Dữ Liệu** | [DATA_FLOWS.md](DATA_FLOWS.md) | Luồng Check-in/Check-out, Luồng Đăng ký khuôn mặt, Luồng Tính lương và Đồng bộ Socket.IO |

---

## 🏗️ Kiến Trúc Hệ Thống (System Design)

### 1. Sơ Đồ Kiến Trúc Tổng Thể

```mermaid
flowchart TB
    subgraph EDGE["📡 AIoT Edge Layer (Thiết bị đầu cuối)"]
        direction LR
        CamIn["FaceCam-01 (Vào ca)<br/>YOLO / SCRFD + PAD + ArcFace"]
        CamOut["FaceCam-02 (Tan ca)<br/>YOLO / SCRFD + PAD + ArcFace"]
        FPIn["Fingerprint-01 (Vào ca)<br/>Optical Sensor / ESP32"]
        FPOut["Fingerprint-02 (Tan ca)<br/>Optical Sensor / ESP32"]
    end

    subgraph TRANSPORT["🔄 Transport Layer"]
        direction LR
        MQTT["MQTT Broker (Mosquitto/EMQX)<br/>Topics: attendance/devices/+/..."]
        WS["WebSocket (Socket.IO v4.8)<br/>JWT Handshake Auth"]
    end

    subgraph BACKEND["⚡ Backend Core Service (Node.js 20 + Express)"]
        direction TB
        Security["Security Layer: Helmet, CORS, Cookie-Parser, Rate-Limit"]
        AuthMiddleware["Auth & RBAC: HttpOnly JWT Cookie, ADMIN / MANAGER / EMPLOYEE"]
        ZodLayer["Validation Layer: Zod DTO Schemas"]
        ModularMonolith["Modular Feature Services:<br/>• Auth & Profile • Employee & Org • Attendance & Locks<br/>• Shifts & Schedules • Payroll Engine • AI Biometrics • Audit Trail"]
        ErrorHandler["Global Error Pipeline: AppError + Prisma Error Codes + Zod Flatten"]
    end

    subgraph AI_SERVICE["🧠 AI Biometrics Internal Service (Python 3.10 + FastAPI)"]
        direction TB
        FastAPIService["FastAPI Service (:5000)<br/>ArcFace 512-D Extraction"]
        CentroidEngine["Centroid Enrollment & Outlier Filter"]
        PADEngine["MobileNetV3-Small Liveness Detection"]
    end

    subgraph DATABASE["🗄️ Database Layer (Neon Serverless PostgreSQL 16)"]
        direction TB
        PGVector["Extension pgvector v0.8.6<br/>HNSW Index Cosine ops"]
        RelationalTables["15 Bảng Dữ Liệu Chuẩn Hóa (ACID Compliant)"]
        Locks["Khóa Chốt Ca (attendance_locks)"]
    end

    subgraph FRONTEND["🎨 Frontend Client Application (React 19 SPA)"]
        direction TB
        ViteApp["Vite + React 19 + TypeScript 5.8"]
        FeatureModules["Pragmatic Features: Attendance, Employees, Payroll, Schedules, Biometrics, Reports"]
        StateAndUI["TanStack Query v5 Cache + Tailwind CSS v4 Glassmorphism"]
    end

    EDGE -- "MQTT Telemetry & Events" --> MQTT
    MQTT --> BACKEND
    EDGE -. "REST API Check-in (Webcam Mode)" .-> BACKEND

    BACKEND <--> "FastAPI Internal Calls (:5000)" <--> AI_SERVICE
    BACKEND -- "Prisma ORM 5.20 (Pooled / Direct)" --> DATABASE
    AI_SERVICE -- "Direct pgvector Cosine Query" --> DATABASE

    BACKEND -- "Real-time Event Broadcast" --> WS
    WS --> FRONTEND
    FRONTEND -- "REST API (Credentials: include)" --> BACKEND
```

---

### 2. Các Phân Hệ Cốt Lõi

1. **Phân hệ AIoT Edge Devices / Sensors**:
   - **Camera AI Thông Minh (`FaceCam-01`, `FaceCam-02`)**: Sử dụng camera góc rộng tích hợp mô hình phát hiện khuôn mặt SCRFD/YunNet, phân loại độ sống động chống giả mạo **MobileNetV3-Small PAD** và trích xuất đặc trưng **ArcFace 512 chiều**.
   - **Máy Chấm Công Vân Tay Dự Phòng (`Fingerprint-01`, `Fingerprint-02`)**: Tích hợp cảm biến quang học qua vi điều khiển ESP32, tự động fallback khi nhân viên đeo khẩu trang hoặc môi trường thiếu sáng.
2. **Phân hệ Backend REST API & Real-time Gateway (Node.js)**:
   - Kiến trúc **Modular Monolith (Vertical Slice)** tách biệt từng domain nghiệp vụ.
   - Tích hợp Gateway hai chiều: **MQTT Client** nhận dữ liệu từ cảm biến và **Socket.IO Server** broadcast sự kiện tức thời về Web Client.
   - Xác thực an toàn tuyệt đối với **HttpOnly, Secure, SameSite=Strict JWT Cookie**, phân quyền 3 cấp **RBAC (`ADMIN`, `MANAGER`, `EMPLOYEE`)**.
3. **Phân hệ AI Biometrics Internal Service (Python)**:
   - Dịch vụ FastAPI nội bộ (:5000) phục vụ đăng ký danh tính (**Enrollment**), tính toán vector đại diện (**Centroid Vector**) và lọc ảnh ngoại lai (**Outlier Filtering**).
4. **Phân hệ Cơ sở Dữ liệu (PostgreSQL 16 + pgvector)**:
   - Lưu trữ quan hệ ACID chuẩn hóa 15 bảng; quản lý vector 512 chiều bằng **`pgvector`** kết hợp chỉ mục xấp xỉ siêu tốc **HNSW Index** theo khoảng cách Cosine (`vector_cosine_ops`).
   - Hỗ trợ triển khai linh hoạt: **Neon Cloud Serverless PostgreSQL** (Khuyên dùng) hoặc **Docker Compose Cục bộ**.
5. **Phân hệ Web Frontend (React 19 SPA)**:
   - Xây dựng theo mô hình **Pragmatic Feature-Based**, tối ưu render mượt mà với **React 19**, định kiểu **Tailwind CSS v4** chuẩn giao diện **Glassmorphism & Dark Mode**, quản lý Server State qua **TanStack Query v5**.

---

## 📁 Cấu Trúc Thư Mục Monorepo

```text
SmartFace-AIoT-Based-Staff-Management-Attendance-System/
├── run.bat                   # ⚡ Menu script 1-Click tự động cho Windows
├── run.sh                    # ⚡ Script 1-Click tự động cho macOS và Linux
├── docker-compose.yml        # Docker Compose (PostgreSQL 16 + pgvector, pgAdmin, Mosquitto)
├── docker-compose.iot.yml    # Docker Compose bổ sung dịch vụ IoT Gateway
├── .env.compose.example      # File biến môi trường mẫu cho Docker
├── DEPLOYMENT_GUIDE.md       # 📖 Hướng dẫn chi tiết triển khai hệ thống từ A-Z
├── DATA_FLOWS.md             # 📖 Sơ đồ chi tiết các luồng dữ liệu nghiệp vụ
│
├── backend/                  # ⚡ PHÂN HỆ BACKEND SERVER (Node.js + Express + Prisma)
│   ├── prisma/               # Quản lý Database Schema, Migrations & 3 bộ Seed độc lập
│   │   ├── schema.prisma     # 15 Models CSDL chuẩn hóa (kèm pgvector & attendance_locks)
│   │   ├── seed.ts           # 🌱 Bước 1: Seed Master Data (Phòng ban, Chức vụ, Tài khoản, Ca, Thiết bị)
│   │   ├── seed-shifts.ts    # 📅 Bước 2: Seed Lịch phân ca theo tháng (Schedules)
│   │   ├── seed-attendance.ts# ⏱️ Bước 3: Seed Lượt chấm công mô phỏng & Summary
│   │   └── README.md         # 📖 Tài liệu chuyên sâu Cơ sở Dữ liệu & Prisma
│   ├── src/
│   │   ├── common/           # AppError, Response Formatter, Permission Helpers, Logger, Mailer
│   │   ├── config/           # Cấu hình Env (Zod), Database (Prisma), MQTT, CORS
│   │   ├── middlewares/      # JWT Cookie Auth, RBAC Authorization, Zod DTO Validator, ErrorHandler
│   │   ├── modules/          # 9 Modules nghiệp vụ (auth, employees, attendance, shifts, payroll...)
│   │   ├── sockets/          # Socket.IO Gateway (/attendance & /devices namespaces)
│   │   └── server.ts         # Khởi tạo HTTP Server, tích hợp Socket.IO & MQTT
│   └── README.md             # 📖 Tài liệu chuyên sâu phân hệ Backend
│
├── frontend/                 # 🎨 PHÂN HỆ GIAO DIỆN NGƯỜI DÙNG (React 19 + Vite + Tailwind v4)
│   ├── src/
│   │   ├── api/              # Axios Client cấu hình credentials HttpOnly & API endpoints
│   │   ├── components/       # UI Reusable Primitives (common) & Application Shell (layout)
│   │   ├── context/          # React Context (AuthContext, ThemeContext, ToastContext)
│   │   ├── features/         # Feature Modules (attendance, employees, biometrics, payroll, schedules, reports)
│   │   ├── hooks/            # Shared custom hooks bọc TanStack React Query v5
│   │   ├── pages/            # Thin Route Coordinators (public, manager, employee)
│   │   ├── providers/        # AppProviders hợp nhất (ErrorBoundary, Theme, Query, Toast, Auth)
│   │   ├── routes/           # Hệ thống định tuyến Router & Route Guards phân quyền
│   │   ├── types/            # Khai báo kiểu TypeScript toàn dự án
│   │   └── utils/            # Chuẩn hóa múi giờ Việt Nam (+07:00), định dạng tiền tệ VND
│   └── README.md             # 📖 Tài liệu chuyên sâu phân hệ Frontend
│
├── face_auth/                # 🧠 PHÂN HỆ AI SINH TRẮC HỌC (Python + InsightFace + PAD)
│   ├── api_service.py        # Dịch vụ FastAPI nội bộ (:5000) trích xuất 512-D ArcFace & pgvector sync
│   ├── app.py                # Ứng dụng Camera AIoT nhận diện & chống giả mạo thời gian thực
│   ├── config.py             # Cấu hình ngưỡng nhận diện Cosine, ArcFace model pack, PAD
│   ├── antispoof/            # Mô hình chống giả mạo MobileNetV3-Small E1 v5.3
│   ├── enrollment/           # Thuật toán tính Centroid embedding đại diện & loại bỏ ảnh nhiễu
│   └── README.md             # 📖 Tài liệu chuyên sâu phân hệ AI Biometrics
│
└── pi_edge/                  # 🍓 Cấu hình & mã nguồn triển khai Raspberry Pi 4 Edge Node
```

---

## 🔑 Dữ Liệu Khởi Tạo & Tài Khoản Kiểm Thử (Seed Accounts)

Sau khi thực hiện quy trình nạp dữ liệu mẫu ban đầu qua lệnh `npm run prisma:seed:all`, hệ thống sẵn sàng với toàn bộ tài khoản và danh mục chuẩn hóa:

### 1. Tài Khoản Quản Trị Viên Tối Cao (Admin)
- **Tên đăng nhập:** `admin`
- **Mật khẩu truy cập:** `Admin@123456`
- **Vai trò:** `ADMIN`
- **Quyền hạn:** Toàn quyền quản trị hệ thống, thêm/sửa/xóa phòng ban và chức vụ, phân quyền tài khoản, cấu hình chính sách thưởng phạt, quản lý thiết bị AIoT và xem Audit Trail.

---

### 2. Danh Sách 6 Quản Lý Phòng Ban (`MANAGER`)
Mỗi phòng ban có đúng **1 Quản lý** phụ trách xem và quản lý nhân viên, lịch ca và dữ liệu chấm công thuộc phòng mình:

| Tên đăng nhập | Mật khẩu mặc định | Họ và tên | Chức vụ | Phòng ban | Mức lương giờ |
| :---: | :---: | :--- | :--- | :---: | :---: |
| **`NV-001`** | `Employee@123456` | Trần Thị Mai | Trưởng phòng Nhân sự | Nhân sự | 160.000 ₫/h |
| **`NV-004`** | `Employee@123456` | Hoàng Minh Tuấn | Kế toán trưởng | Kế toán | 170.000 ₫/h |
| **`NV-007`** | `Employee@123456` | Nguyễn Tiến Dũng | Trưởng phòng Kinh doanh | Kinh doanh | 165.000 ₫/h |
| **`NV-010`** | `Employee@123456` | Phạm Thu Thủy | Trưởng phòng Marketing | Marketing | 155.000 ₫/h |
| **`NV-013`** | `Employee@123456` | Đặng Quốc Huy | Trưởng phòng CNTT | IT | 180.000 ₫/h |
| **`NV-016`** | `Employee@123456` | Bùi Thanh Tùng | Trưởng phòng CSKH | CSKH | 150.000 ₫/h |

---

### 3. Danh Sách 12 Nhân Viên Thông Thường (`EMPLOYEE`)
Mỗi nhân viên sở hữu tài khoản cá nhân để theo dõi ca làm, xem lịch sử chấm công và tra cứu phiếu lương cá nhân:

| Tên đăng nhập | Mật khẩu mặc định | Họ và tên | Chức vụ | Phòng ban |
| :---: | :---: | :--- | :--- | :---: |
| **`NV-002`** | `Employee@123456` | Lê Thu Trang | Chuyên viên Tuyển dụng | Nhân sự |
| **`NV-003`** | `Employee@123456` | Đỗ Văn Hùng | Chuyên viên C&B | Nhân sự |
| **`NV-005`** | `Employee@123456` | Vũ Bích Ngọc | Kế toán tổng hợp | Kế toán |
| **`NV-006`** | `Employee@123456` | Ngô Thành Nam | Kế toán tiền lương | Kế toán |
| **`NV-008`** | `Employee@123456` | Đinh Phương Thảo | Chuyên viên Quản lý khách hàng | Kinh doanh |
| **`NV-009`** | `Employee@123456` | Lương Mạnh Hải | Đại diện Kinh doanh | Kinh doanh |
| **`NV-011`** | `Employee@123456` | Trịnh Kim Chi | Chuyên viên Nội dung | Marketing |
| **`NV-012`** | `Employee@123456` | Hồ Hoàng Long | Chuyên viên Digital Marketing | Marketing |
| **`NV-014`** | `Employee@123456` | Mai Đức Chung | Kỹ sư Phần mềm | IT |
| **`NV-015`** | `Employee@123456` | Lý Quốc Bảo | Kỹ sư Hệ thống & AIoT | IT |
| **`NV-017`** | `Employee@123456` | Đoàn Hải Yến | Chuyên viên Hỗ trợ khách hàng | CSKH |
| **`NV-018`** | `Employee@123456` | Dương Khánh Huyền | Chuyên viên Trực tổng đài | CSKH |

> [!NOTE]
> Mật khẩu `Employee@123456` áp dụng cho dữ liệu seed ban đầu để phục vụ kiểm thử. Khi quản trị viên tạo mới nhân viên trên giao diện thực tế, hệ thống sẽ tự động tạo mật khẩu ngẫu nhiên bảo mật 8 ký tự và gửi qua email cho nhân viên.

---

### 4. Danh Mục Ca Làm Việc & Thiết Bị AIoT
- **4 Ca làm việc chuẩn hóa (`work_shifts`)**:
  - `Full time`: 08:00 - 18:00
  - `Part time: Ca sáng`: 08:00 - 12:00
  - `Part time: Ca chiều`: 13:00 - 18:00
  - `Nghỉ (OFF)`: 00:00 - 00:00 (Áp dụng ngày Chủ Nhật hoặc ngày nghỉ)
- **4 Thiết bị AIoT chuẩn hóa (`devices`)**:
  - `FaceCam-01`: Camera AI nhận diện Face-ID Vào ca (Cổng vào, IP: `192.168.1.101`)
  - `FaceCam-02`: Camera AI nhận diện Face-ID Tan ca (Cổng ra, IP: `192.168.1.102`)
  - `Fingerprint-01`: Máy quét vân tay Vào ca (Cửa chính, IP: `192.168.1.103`)
  - `Fingerprint-02`: Máy quét vân tay Tan ca (Cửa ra, IP: `192.168.1.104`)

---

## ⚡ Hướng Dẫn Khởi Chạy Toàn Bộ Dự Án

### 📋 Yêu Cầu Tiên Quyết (Prerequisites)
1. **Node.js**: Phiên bản `v20.x` hoặc `v22.x LTS` (kèm `npm`).
2. **Cơ sở dữ liệu PostgreSQL 16 + pgvector**:
   - **Lựa chọn 1 (Khuyên dùng)**: [Neon Serverless PostgreSQL](https://neon.tech/) (Singapore `ap-southeast-1`).
   - **Lựa chọn 2**: Cài đặt Docker Desktop để chạy PostgreSQL local.
3. **Python (Tùy chọn)**: Phiên bản `3.10` hoặc `3.11` (nếu cần chạy dịch vụ Face Auth AI).

---

### 🟢 Cách 1: Khởi Chạy Nhanh Bằng 1-Click Script (Khuyên dùng)

Dự án cung cấp launcher thông minh tự động hóa toàn bộ thao tác cấu hình và khởi chạy:

- **Trên Windows**:
  ```cmd
  .\run.bat
  ```
- **Trên macOS / Linux**:
  ```bash
  chmod +x run.sh && ./run.sh
  ```

#### Bảng Lựa Chọn Chức Năng Của Menu Script:
| Phím chọn | Chức năng thực thi |
| :---: | :--- |
| **`[1]` (Mặc định)** | **Chạy toàn bộ (Backend + Frontend + Face Auth API)** kết nối tới Cloud Database |
| **`[2]`** | **Chạy toàn bộ kèm theo Docker Database Local** (PostgreSQL + pgAdmin) |
| **`[3]`** | **Chỉ chạy riêng Backend Service** tại cổng `http://localhost:3000` |
| **`[4]`** | **Chỉ chạy riêng Frontend Web App** tại cổng `http://localhost:5173` |
| **`[5]`** | **Khởi động dịch vụ Docker Database Local** (PostgreSQL + pgAdmin) |
| **`[6]`** | **Cài đặt toàn bộ dependencies** cho cả Backend và Frontend |
| **`[7]`** | **Thực thi Prisma Generate & Migration** cập nhật Database Schema |
| **`[8]`** | **Mở Web GUI Prisma Studio** tại địa chỉ `http://localhost:5555` |
| **`[0]`** | Thoát chương trình |

> 💡 **Quy trình chuẩn cho thành viên mới clone repo:**  
> 1. Gõ `.\run.bat` $\rightarrow$ Chọn `[6]` để cài dependencies và tạo file `.env`.  
> 2. Điền chuỗi kết nối Database vào file `backend/.env`.  
> 3. Chọn `[7]` để migrate database.  
> 4. Nhấn Enter (chọn `[1]`) để tận hưởng toàn bộ hệ thống!

---

### 🟡 Cách 2: Khởi Chạy Thủ Công Từng Bước (Manual Setup)

#### Bước 1: Khởi tạo các file biến môi trường (`.env`)
```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env
```

#### Bước 2: Thiết lập Cơ sở Dữ liệu & Chạy Migration
```bash
cd backend
npm install

# 1. Sinh Prisma Client
npx prisma generate

# 2. Áp dụng các bản SQL Migration
npx prisma migrate deploy

# 3. Nạp dữ liệu mẫu ban đầu (Nếu database mới)
npm run prisma:seed:all
```

#### Bước 3: Khởi chạy Backend Server
```bash
cd backend
npm run dev
# Backend sẵn sàng tại: http://localhost:3000
# Kiểm tra Health Check: GET http://localhost:3000/health
```

#### Bước 4: Khởi chạy Frontend Web App (Mở Terminal mới)
```bash
cd frontend
npm install
npm run dev
# Frontend sẵn sàng tại: http://localhost:5173
```

#### Bước 5: Khởi chạy Face Auth Service (Tùy chọn - Mở Terminal mới)
```bash
cd face_auth
# Kích hoạt virtualenv (nếu có)
uvicorn api_service:app --host 0.0.0.0 --port 5000
# Face Auth API sẵn sàng tại: http://localhost:5000
```

---

## 🧪 Kiểm Thử Toàn Diện (Testing & Quality Assurance)

Hệ thống được trang bị bộ kiểm thử tự động nghiêm ngặt ở cả hai phân hệ:

```bash
# 1. Chạy Unit & Integration Tests của Backend (Vitest)
cd backend && npm run test

# 2. Chạy Component & Hook Tests của Frontend (Vitest + JSDOM)
cd frontend && npm run test

# 3. Kiểm tra tính toàn vẹn kiểu dữ liệu TypeScript
cd frontend && npm run lint
```

---

## 📄 License & Bản Quyền

Dự án được phân phối chính thức theo giấy phép **MIT License**. Mọi mã nguồn và tài liệu tuân thủ nghiêm ngặt các quy chuẩn về an toàn thông tin, bảo mật sinh trắc học và đạo đức AI.
