# 🛡️ SmartFace: AIoT-Based Staff Management & Attendance System

<<<<<<< Updated upstream
> **SmartFace** là Nền tảng Quản lý Nhân sự & Chấm công Thông minh ứng dụng công nghệ **AIoT (Artificial Intelligence of Things)**. Hệ thống tích hợp xác thực sinh trắc học gương mặt qua Edge AI Camera, cơ chế phát hiện giả mạo gương mặt **PAD (Presentation Attack Detection)**, điểm danh vân tay dự phòng (**Fingerprint Fallback**), cùng hệ thống tự động tính lương (**Payroll Engine**) và giám sát thời gian thực qua **WebSockets/MQTT**.
=======
> **SmartFace** là Nền tảng Quản lý Nhân sự & Chấm công Thông minh ứng dụng AIoT, tích hợp xác thực khuôn mặt sinh trắc học, chống giả mạo (Presentation Attack Detection - PAD) và cơ chế điểm danh sinh trắc học vân tay dự phòng (Fingerprint Fallback).
>>>>>>> Stashed changes

---

## 🏷️ Badges

<<<<<<< Updated upstream
![Node.js](https://img.shields.io/badge/Node.js-v20+-339933.svg?style=flat-square&logo=nodedotjs)
![React](https://img.shields.io/badge/React-v19-61DAFB.svg?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.8-3178C6.svg?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1.svg?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-v6.4-2D3748.svg?style=flat-square&logo=prisma)
![Vite](https://img.shields.io/badge/Vite-v6.2-646CFF.svg?style=flat-square&logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-06B6D4.svg?style=flat-square&logo=tailwindcss)
![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?style=flat-square&logo=docker)
=======
![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg?style=flat-square&logo=nodedotjs)
![React](https://img.shields.io/badge/React-v19-61DAFB.svg?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-v5.7-blue.svg?style=flat-square&logo=typescript)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-336791.svg?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-v6.4-2D3748.svg?style=flat-square&logo=prisma)
![Vite](https://img.shields.io/badge/Vite-v6.2-646CFF.svg?style=flat-square&logo=vite)
>>>>>>> Stashed changes
![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)

---

## 🏗️ Sơ Đồ Kiến Trúc Hệ Thống (System Architecture)

```text
<<<<<<< Updated upstream
┌───────────────────────────────────────────────────────────────────────────┐
│                        AIoT EDGE DEVICES / CAMERAS                        │
│  - Edge Camera (YOLO Face Detection + MobileNetV3/DCT PAD + ArcFace)     │
│  - Fingerprint Sensor Node (ESP32 / Optical Fingerprint Reader)           │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │ MQTT Protocols / REST API
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICE (Node.js)                         │
│  - RESTful API Gateway (Express.js + Zod DTO Validation)                  │
│  - Real-time Gateway (Socket.IO Broadcast & MQTT Subscriber)              │
│  - Security Layer (JWT Auth, Role-based AC, AES Biometric Encryption)     │
│  - Business Engine (Attendance, Employee, Shift, Payroll, Biometrics)     │
└───────────────────┬─────────────────────────────────┬─────────────────────┘
                    │                                 │
                    ▼ Prisma ORM                      ▼ WebSocket Stream
┌──────────────────────────────────┐        ┌──────────────────────────────┐
│       DATABASE LAYER             │        │     FRONTEND DASHBOARD       │
│  - PostgreSQL 16 (Relational DB) │        │  - React 19 + Vite + TS      │
│  - pgvector (512-D Embeddings)   │        │  - Tailwind CSS v4 + Recharts│
└──────────────────────────────────┘        └──────────────────────────────┘
=======
┌─────────────────────────────────────────────────────────────────────────┐
│                        AIoT EDGE DEVICES / CAMERAS                       │
│  - Edge Camera (YOLO Face Detection + MobileNetV3/DCT PAD + ArcFace)   │
│  - Fingerprint Sensor Node (ESP32 / Optical Fingerprint Scanner)        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ MQTT / REST API
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICE (Node.js)                       │
│  - RESTful API (Express.js + Zod Validation)                            │
│  - Authentication & AuthZ (JWT + Role-based Access Control)            │
│  - Real-time Engine (Socket.IO Gateway & MQTT Subscriber)               │
│  - Business Services (Attendance, Employee, Shift, Payroll, Biometrics) │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
                    ▼ Prisma ORM                      ▼ WebSocket Broadcast
┌───────────────────────────────┐         ┌───────────────────────────────┐
│     DATABASE LAYER            │         │    FRONTEND DASHBOARD         │
│ - PostgreSQL (Relational DB)  │         │ - React 19 + TypeScript       │
│ - pgvector (Face Embeddings)  │         │ - Tailwind CSS + Vite Proxy   │
└───────────────────────────────┘         └───────────────────────────────┘
>>>>>>> Stashed changes
```

---

<<<<<<< Updated upstream
## 📁 Cấu Trúc Dự Án (Monorepo Layout)

```text
SmartFace-AIoT-Based-Staff-Management-Attendance-System/
├── run.bat                   # ⚡ File script tự động khởi chạy 1-click trên Windows
├── backend/                  # REST API & Real-time Server (Node.js, Express, Prisma)
│   ├── docker-compose.yml    # Docker Compose khởi chạy PostgreSQL & pgAdmin
│   ├── prisma/               # Database Schema, Migrations & Seed data
│   ├── src/                  # Controllers, Services, Middlewares, Sockets, DTOs
│   └── README.md             # 📖 Tài liệu chi tiết phân hệ Backend -> backend/README.md
├── frontend/                 # Web Application (React 19, Vite, Tailwind CSS v4)
│   ├── src/                  # Components, Pages, Context, Types, Utils
│   └── README.md             # 📖 Tài liệu chi tiết phân hệ Frontend -> frontend/README.md
├── docs/                     # Tài liệu thiết kế kiến trúc & API specification
├── .env.example              # Template biến môi trường mẫu
├── .gitignore                # Git ignore root
└── README.md                 # Tài liệu tổng quan hệ thống (Root)
=======
## 📁 Cấu Trúc Monorepo

```text
SmartFace-AIoT-Based-Staff-Management-Attendance-System/
├── backend/                  # REST API & Real-time Server (Node.js, Express, Prisma)
│   ├── prisma/               # Database Schema, Migrations & Seed data
│   ├── src/                  # Controllers, Services, Middlewares, Sockets
│   └── README.md             # 📖 Tài liệu chi tiết Backend -> backend/README.md
├── frontend/                 # Web Application (React 19, Vite, Tailwind CSS)
│   ├── src/                  # Components, Pages, Context, Types, Utils
│   └── README.md             # 📖 Tài liệu chi tiết Frontend -> frontend/README.md
├── docs/                     # Tài liệu thiết kế & API specification
├── .env.example              # Template cấu hình môi trường mẫu gốc
├── .gitignore                # Git ignore root
└── README.md                 # Tài liệu tổng quan hệ thống (Root)
```

> 📖 **Xem chi tiết tài liệu từng phân hệ**:
> - [Backend Documentation](backend/README.md)
> - [Frontend Documentation](frontend/README.md)

---

## ⚡ Quick Start (Khởi Chạy Nhanh)

### Bước 1: Khởi chạy Backend Service

```bash
# 1. Truy cập thư mục backend & cài đặt dependencies
cd backend
npm install

# 2. Tạo file cấu hình môi trường & chạy migration database
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed

# 3. Khởi chạy server ở chế độ Development
npm run dev
# Server lắng nghe tại: http://localhost:3000
```

### Bước 2: Khởi chạy Frontend Web App

```bash
# 1. Mở cửa sổ terminal mới, truy cập thư mục frontend & cài đặt dependencies
cd frontend
npm install

# 2. Tạo file biến môi trường & khởi chạy Vite dev server
cp .env.example .env
npm run dev
# Web application truy cập tại: http://localhost:5173
>>>>>>> Stashed changes
```

---

<<<<<<< Updated upstream
## ⚡ Quick Start (Khởi Chạy Nhanh Dự Án)

### 🟢 Cách 1: Tự Động Khởi Chạy Bằng 1-Click (`run.bat` - Dành cho Windows)

Dự án đã tích hợp sẵn file script [run.bat](file:///e:/PBL6/SmartFace-AIoT-Based-Staff-Management-Attendance-System/run.bat) giúp khởi động toàn bộ ứng dụng chỉ bằng 1 thao tác:

1. Mở Terminal / CMD tại thư mục gốc dự án hoặc nhấp đôi chuột vào file `run.bat`:
   ```cmd
   .\run.bat
   ```
2. Giao diện Menu tương tác sẽ xuất hiện cho phép chọn các tùy chọn khởi chạy:
   - **`[1]` Chạy toàn bộ hệ thống**: Tự động mở Docker Database (PostgreSQL + pgAdmin) và khởi chạy Backend (Port 3000) cùng Frontend (Port 5173) trong 2 cửa sổ terminal riêng biệt.
   - **`[2]` Chạy Backend & Frontend**: Bỏ qua bước Docker (dành cho môi trường đã bật DB).
   - **`[6]` Cài đặt dependencies**: Tự động cài đặt gói cho cả Backend và Frontend.
   - **`[7]` Chạy Prisma Migrate & Seed Data**: Khởi tạo cấu trúc bảng và nạp dữ liệu mẫu ban đầu.

---

### 🟡 Cách 2: Khởi Chạy Thủ Công (Manual Setup)

#### Bước 1: Khởi động Cơ sở dữ liệu (PostgreSQL)

Có thể sử dụng Docker Compose trong thư mục backend:
```bash
cd backend
docker compose up -d
```
*Database sẽ khởi chạy tại port `5432` và pgAdmin tại port `5050`.*

#### Bước 2: Khởi chạy Backend Service

```bash
# 1. Truy cập thư mục backend & cài đặt dependencies
cd backend
npm install

# 2. Tạo file cấu hình môi trường & chạy migration database
cp .env.example .env
npm run prisma:migrate
npm run prisma:seed

# 3. Khởi chạy Backend ở chế độ Development
npm run dev
# Server lắng nghe tại: http://localhost:3000
```

#### Bước 3: Khởi chạy Frontend Web App

```bash
# 1. Truy cập thư mục frontend & cài đặt dependencies
cd frontend
npm install

# 2. Tạo file biến môi trường & khởi chạy Vite dev server
cp .env.example .env
npm run dev
# Web App truy cập tại: http://localhost:5173
```

---

## ✨ Tính Năng Nổi Bật (Key Features)

- 👁️ **Xác thực Sinh trắc học AIoT kép**: Điểm danh gương mặt chính xác cao qua Edge AI Camera và vân tay dự phòng (Fingerprint Fallback) qua node ESP32.
- 🛡️ **Chống Giả Mạo Gương Mặt (PAD)**: Tích hợp kiến trúc Spatial-Frequency PAD kết hợp MobileNetV3 và 2D DCT chống tấn công bằng ảnh in, video hoặc màn hình thiết bị di động.
- ⚡ **Giám sát Chấm công Real-time**: Cập nhật thông báo Check-in / Check-out tức thì trên Dashboard quản trị thông qua WebSockets (Socket.IO) & MQTT protocol.
- 👥 **Quản lý Hồ sơ & Mã hóa Sinh trắc học**: Quản lý phòng ban, chức vụ, trạng thái hoạt động và lưu trữ vector đặc trưng gương mặt được mã hóa an toàn với chuẩn AES-256.
- 📅 **Lập Lịch & Phân Ca Linh Hoạt**: Định nghĩa ca làm việc (ca sáng, hành chính, ca đêm) và phân lịch ca chi tiết cho từng nhân viên hoặc bộ phận.
- 💰 **Hệ thống Tự động Tính Lương (Payroll Engine)**: Tự động tính toán tổng giờ làm, giờ phạt đi trễ / về sớm, hệ số tăng ca (OT), tạm ứng và chốt phiếu lương hàng tháng.
- 📱 **Cổng Tự Phục Vụ Nhân Viên (Employee Portal)**: Giao diện dành riêng cho nhân viên tự tra cứu lịch làm việc, lịch sử điểm danh và ước tính thu nhập thực tế.

---

## 🛠 Tech Stack Tổng Quan

| Phân hệ | Công nghệ & Thư viện sử dụng |
| :--- | :--- |
| **Backend API** | Node.js (v20+), TypeScript, Express.js, Prisma ORM (v6.4), Zod Validation |
| **Frontend Web** | React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, Recharts |
| **Database Layer** | PostgreSQL 16 + pgvector extension (lưu trữ 512-D face embeddings) |
| **Real-time & IoT** | Socket.IO (WebSockets), MQTT Client (`mqtt` broker connection) |
| **Security & Auth** | JSON Web Tokens (JWT), Bcrypt hashing, AES-256 Biometric Encryption, Helmet |

---

## 🖥️ Yêu Cầu Hệ Thống (System Requirements)

- **Node.js**: `≥ 20.0.0`
- **npm**: `≥ 10.0.0`
- **PostgreSQL**: `≥ 14.0` (Khuyên dùng PostgreSQL 16 tích hợp `pgvector`)
- **Docker & Docker Compose** *(Khuyên dùng để chạy DB & pgAdmin nhanh chóng)*
- **MQTT Broker** *(Tùy chọn khi kết nối thiết bị phần cứng thật)*: Mosquitto hoặc EMQX

---

## 🔗 Tài Liệu Chi Tiết Các Phân Hệ

- 📘 [Tài liệu Backend Detail](backend/README.md) — Chi tiết REST API Endpoints, MQTT Topics, Socket.IO Events & Troubleshooting.
- 🗄️ [Tài liệu Database & Prisma Detail](backend/prisma/README.md) — Chi tiết 13 Models Schema, ERD, Prisma CLI & Seed Data.
- 📙 [Tài liệu Frontend Detail](frontend/README.md) — Chi tiết React Components, AppContext State Management, Routes, Theme Glassmorphism & Production Deployment.

---

## 👥 Thành Viên Phát Triển (Development Team)

| Họ và Tên | Vai trò chính | Email liên hệ |
| :--- | :--- | :--- |
| **Nguyễn Văn A** | AIoT & Embedded Systems Lead | `anv@aiot.corp` |
| **Lê Hoàng Phúc** | Backend & Database Architect | `phuc.le@aiot.corp` |
| **Trần Minh Anh** | Frontend & UI/UX Engineer | `anh.tran@aiot.corp` |

---

## 📄 License

Dự án được phân phối dưới giấy phép **MIT License**. Xem thêm chi tiết tại file [LICENSE](LICENSE).
=======
## ✨ Tính Năng Chính (Key Features)

- **Xác thực Sinh trắc học AIoT kép**: Chấm công gương mặt primary qua Edge AI Camera và vân tay dự phòng (Fingerprint Fallback).
- **Chống Giả Mạo Gương Mặt (PAD)**: Tích hợp kiến trúc Spatial-Frequency PAD kết hợp MobileNetV3 và 2D DCT chống tấn công ảnh in / màn hình.
- **Giám sát Chấm công Real-time**: Cập nhật lượt Check-in / Check-out theo thời gian thực lên Dashboard thông qua WebSockets (Socket.IO).
- **Quản lý Nhân sự Toàn diện**: Quản lý hồ sơ nhân viên, trạng thái hoạt động, phòng ban, chức vụ và vector sinh trắc học mã hóa.
- **Sắp xếp Lịch làm & Ca làm việc**: Phân ca linh hoạt (Ca sáng, ca chiều, hành chính, ca đêm) cho từng nhân viên hoặc bộ phận.
- **Tự động Tính Lương (Payroll Engine)**: Tự động tổng hợp giờ làm, tính phạt đi trễ / về sớm, lương tăng ca (OT), tạm ứng và xuất phiếu lương.
- **Cổng thông tin Nhân viên (Employee Portal)**: Nhân viên tự tra cứu lịch trình làm việc, lịch sử chấm công và bảng ước tính lương hàng tháng.

---

## 🛠 Tech Stack Tổng Quan

| Layer | Công nghệ chính sử dụng |
| :--- | :--- |
| **Backend API** | Node.js, TypeScript, Express.js, Prisma ORM, Zod validation |
| **Frontend Web** | React 19, Vite, TypeScript, Tailwind CSS v4, Lucide React, Recharts |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Real-time & IoT** | Socket.IO (WebSockets), MQTT Protocol (`mqtt` broker client) |
| **Authentication** | JSON Web Tokens (JWT), Bcrypt password hashing, AES-256 Biometric encryption |

---

## 🖥️ Yêu Cầu Hệ Thống (System Requirements)

- **Node.js**: `≥ 20.0.0`
- **npm**: `≥ 10.0.0`
- **PostgreSQL**: `≥ 14.0` (Khuyên dùng PostgreSQL 16 có hỗ trợ `pgvector`)
- **MQTT Broker** *(Tùy chọn cho thiết bị phần cứng)*: Eclipse Mosquitto hoặc EMQX

---

## 🔗 Liên Kết Tài Liệu (Documentation Links)

- [Backend Documentation](backend/README.md) — Chi tiết API, database schema, MQTT/Socket events & troubleshooting.
- [Frontend Documentation](frontend/README.md) — Chi tiết React components, state management (AppContext), routes & deployment.

---

## 👥 Thành Viên Phát Triển (Team & Contact)

| Họ và Tên | Vai trò | Email liên hệ |
| :--- | :--- | :--- |
| **Nguyễn Văn A** | AIoT & Embedded Systems Lead | `anv@aiot.corp` |
| **Lê Hoàng Phúc** | Backend & Database Architect | `phuc.le@aiot.corp` |
| **Trần Minh Anh** | Frontend & UI/UX Engineer | `anh.tran@aiot.corp` |

---

## 📄 License

Dự án được phân phối dưới giấy phép **MIT License**. Xem chi tiết tại file [LICENSE](LICENSE).
>>>>>>> Stashed changes
