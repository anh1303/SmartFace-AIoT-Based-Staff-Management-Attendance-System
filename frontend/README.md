# 🎨 SmartFace Frontend — React 19 + Vite + Tailwind CSS v4

> **SmartFace Frontend** là ứng dụng Web Single Page Application (SPA) hiện đại cung cấp hai phân hệ chính: **Cổng Quản trị (Admin & Manager Portal)** và **Cổng Tự Phục Vụ Nhân Viên (Employee Self-Service Portal)** thuộc Hệ sinh thái Quản lý Nhân sự & Chấm công Thông minh SmartFace AIoT.  
> Được xây dựng trên nền tảng **React 19**, **Vite (v6.2)**, **TypeScript (v5.8)**, **TanStack React Query v5** và **Tailwind CSS v4** theo ngôn ngữ thiết kế **Bento Grid & Glassmorphism**, ứng dụng kết nối dữ liệu thời gian thực qua **Socket.IO** và tích hợp trình phát video độ trễ thấp **WebRTC** trực tiếp từ Edge AI Camera.

---

## 📑 Mục lục
1. [Giới thiệu Frontend](#1-giới-thiệu-frontend)
2. [Công nghệ](#2-công-nghệ)
3. [Yêu cầu môi trường](#3-yêu-cầu-môi-trường)
4. [Cài đặt và cấu hình](#4-cài-đặt-và-cấu-hình)
5. [Chạy ứng dụng](#5-chạy-ứng-dụng)
6. [Các chức năng chính](#6-các-chức-năng-chính)
7. [Cấu trúc thư mục](#7-cấu-trúc-thư-mục)
8. [Tích hợp Backend](#8-tích-hợp-backend)
9. [Build và Troubleshooting](#9-build-và-troubleshooting)

---

## 1. Giới thiệu Frontend

### Vai trò của Frontend trong hệ thống
* **Giao diện Quản trị Trung tâm (Admin & Manager Portal):** Dành cho Quản trị viên và Trưởng phòng ban để giám sát tỷ lệ đi làm hôm nay, quản lý hồ sơ nhân sự, phân ca làm việc theo tuần/tháng, theo dõi bảng chấm công 2 dòng (Vào ca/Hết ca) với 3 trạng thái chuẩn hóa, xem live feed nhận diện khuôn mặt và chốt sổ kỳ lương.
* **Giao diện Tự phục vụ Nhân viên (Employee Portal):** Dành cho từng nhân viên tra cứu ca làm việc cá nhân trong ngày, theo dõi toàn bộ lịch sử quẹt thẻ Check-in / Check-out và xem dự tính thu nhập bảng lương minh bạch.
* **Tích hợp Camera Real-time:** Xem luồng video trực tiếp từ Edge AI Camera qua giao thức WebRTC (WHEP) với độ trễ cực thấp (< 500ms).

---

## 2. Công nghệ

Hệ thống sử dụng các công nghệ và thư viện hiện đại nhất trong hệ sinh thái React:

| Thư viện / Công nghệ | Phiên bản | Vai trò & Mục đích sử dụng |
| :--- | :---: | :--- |
| **React** | `v19.0.1` | Thư viện UI cốt lõi, tận dụng tính năng kết xuất đồng thời (Concurrent Features) |
| **Vite** | `v6.2.3` | Build tool và Dev Server tốc độ cao với cơ chế Hot Module Replacement (HMR) |
| **TypeScript** | `v5.8.2` | Kiểm tra kiểu tĩnh nghiêm ngặt cho toàn bộ Components, State, Props và API DTOs |
| **TanStack React Query** | `v5.103.2` | Quản lý Server State, lưu bộ nhớ đệm (Caching), tự động Refetch ngầm và Optimistic Updates |
| **Tailwind CSS** | `v4.1.14` | Styling framework thế hệ mới, tối ưu hóa CSS qua `@tailwindcss/vite` |
| **React Router DOM** | `v7.18.3` | Định tuyến Client-side và bảo vệ luồng truy cập với Route Guards phân quyền RBAC |
| **Recharts** | `v3.10.1` | Trực quan hóa dữ liệu biểu đồ phân tích chấm công và xu hướng chi phí lương |
| **Lucide React** | `v0.546.0` | Bộ biểu tượng SVG vector chuẩn hóa giao diện người dùng |
| **Socket.IO Client** | `v4.8.1` | Nhận sự kiện chấm công và thông báo trạng thái thiết bị thời gian thực qua WebSocket |

---

## 3. Yêu cầu môi trường

Để cài đặt và chạy Frontend, môi trường máy tính cần chuẩn bị:
* **Node.js:** Phiên bản `>= 20.0.0`. Kiểm tra bằng lệnh: `node -v`
* **npm:** Phiên bản `>= 10.0.0`. Kiểm tra bằng: `npm -v`
* **Trình duyệt Web:** Google Chrome, Microsoft Edge, Firefox, Safari (khuyến nghị phiên bản mới nhất hỗ trợ WebRTC, WebSocket và ES2022).

---

## 4. Cài đặt và cấu hình

### Bước 1: Di chuyển vào thư mục Frontend
```bash
cd frontend
```

### Bước 2: Cài đặt Dependencies
```bash
npm install
```

### Bước 3: Cấu hình biến môi trường
Tạo file `.env` từ file mẫu `.env.example`:
```bash
# Trên Windows (Command Prompt / PowerShell):
copy .env.example .env

# Trên Linux / macOS / Git Bash:
cp .env.example .env
```

### Chi tiết các biến môi trường trong `.env`:
```env
# VITE_API_BASE: Địa chỉ Base URL của Backend API.
# Khuyến nghị để trống "" khi chạy local để sử dụng cơ chế Vite Proxy (/api -> http://localhost:3000)
VITE_API_BASE=""

# VITE_SOCKET_URL: Địa chỉ WebSocket Backend phục vụ sự kiện Real-time qua Socket.IO
VITE_SOCKET_URL="http://localhost:3000"
```

---

## 5. Chạy ứng dụng

### 1. Khởi chạy Development Server
```bash
npm run dev
```
> Ứng dụng sẽ khởi chạy tại: `http://localhost:5173` (hoặc mạng LAN: `http://<IP-của-bạn>:5173`)

### 2. Kiểm tra lỗi kiểu TypeScript (Type-checking)
```bash
npm run lint
# hoặc chạy trực tiếp: npx tsc --noEmit
```

### 3. Đóng gói Production (Build)
```bash
npm run build
```
> Toàn bộ mã nguồn và tài nguyên tĩnh đã tối ưu hóa sẽ được lưu trữ tại thư mục `dist/`.

### 4. Xem trước bản Build Production (Preview)
```bash
npm run preview
```

---

## 6. Các chức năng chính

### 1. Xác thực & Phân quyền bảo mật (RBAC)
* Đăng nhập thông minh phân luồng tự động theo Role:
  * `ADMIN` & `MANAGER` -> Điều hướng tới `/manager/dashboard`
  * `EMPLOYEE` -> Điều hướng tới `/employee/dashboard`
* Phiên làm việc được quản lý bằng Cookie `HttpOnly` an toàn, ngăn chặn tấn công XSS.
* Bảo vệ đường dẫn bằng `ManagerGuard` và `EmployeeGuard`.

### 2. Quản lý Nhân sự (Employee Management)
* Danh sách nhân viên với thanh tìm kiếm và bộ lọc nhanh theo Phòng ban / Chức vụ.
* Giao diện chi tiết nhân viên đa tab: Thông tin cá nhân, Lịch làm việc tuần/tháng, Lịch sử chấm công, Bảng lương và Dữ liệu sinh trắc học.
* Drawer quản lý linh hoạt danh mục Phòng ban và Chức vụ.

### 3. Theo dõi & Giám sát Chấm công (Attendance Monitor)
* **Bảng theo dõi chấm công cấu trúc 2 dòng:**
  * Mỗi nhân viên hiển thị đồng thời 2 dòng sự kiện: **`• Vào Ca`** và **`• Hết ca`**.
  * Cung cấp đầy đủ thông tin: Phương thức nhận diện (Face-id/Vân tay), độ tin cậy %, số giờ trễ/sớm và giờ tăng ca (OT).
* **3 trạng thái chấm công chuẩn hóa:**
  * **`Đúng giờ`**: Badge màu xanh lá (`bg-[#0c2a20] text-emerald-400`)
  * **`Đi muộn`**: Badge màu đỏ (`bg-[#38101a] text-rose-400`)
  * **`Về sớm`**: Badge màu đỏ (`bg-[#38101a] text-rose-400`)
  * *(Nếu chưa có lượt quẹt thẻ: hiển thị `--` tinh gọn)*
* **Live Feed & WebRTC Camera:** Cập nhật luồng quẹt thẻ tức thì qua Socket.IO và xem trực tiếp hình ảnh Edge AI Camera.
* Chức năng khóa dữ liệu chấm công theo ngày và xuất báo cáo CSV.

### 4. Sắp xếp Lịch & Phân ca (Schedules)
* Bảng ma trận phân ca (`ScheduleMatrixTable`) trực quan theo tuần và theo tháng.
* Thao tác đổi ca nhanh hoặc phân ca hàng loạt cho toàn bộ nhân viên trong phòng ban.

### 5. Quản lý Bảng lương (Payroll)
* Tự động tính toán bảng lương từ dữ liệu chấm công thực tế đã chốt.
* Quản lý các khoản thưởng, phạt minh bạch và hỗ trợ chức năng chốt sổ bảng lương kỳ.

### 6. Đăng ký Sinh trắc học (Biometrics eKYC)
* Tích hợp camera chụp ảnh trực tiếp tại trình duyệt để đăng ký khuôn mặt cho nhân viên, tạo vector ArcFace Centroid.

---

## 7. Cấu trúc thư mục

Frontend được tổ chức theo kiến trúc **Feature-Driven Architecture** chuẩn mực:

```text
frontend/src/
├── api/                     # Axios Client instance (withCredentials: true) và các hàm gọi API
├── components/              # UI Primitives tái sử dụng (Bento Design System):
│   ├── common/              # Table, Modal, Drawer, FilterSelect, Toast, SearchInput...
│   └── layout/              # Khung sườn giao diện: AppLayout, Sidebar, Topbar
├── config/                  # Cấu hình API endpoints và Socket URLs
├── context/                 # React Context Layer: AuthContext, ThemeContext, ToastContext, AppContext
├── features/                # 6 Feature Modules nghiệp vụ:
│   ├── attendances/         # Giám sát chấm công, AttendanceTable, WebRTCPlayer, LiveFeed
│   ├── biometrics/          # Đăng ký khuôn mặt eKYC, bảng quản lý mẫu sinh trắc học
│   ├── employees/           # Danh sách nhân viên, Drawer phòng ban/chức vụ, tabs chi tiết
│   ├── payrolls/            # Bảng lương theo kỳ, điều chỉnh thưởng phạt, chốt lương
│   ├── reports/             # Báo cáo phân tích chấm công và cơ cấu chi phí lương (Recharts)
│   └── schedules/           # Ma trận phân ca tuần/tháng (ScheduleMatrixTable), phân ca hàng loạt
├── hooks/                   # Custom hooks tích hợp TanStack React Query v5
├── pages/                   # Thin Route Coordinators (Điều phối Layout):
│   ├── public/              # LandingPage, LoginPage
│   ├── manager/             # Các trang dành cho Quản lý & Admin
│   └── employee/            # Các trang dành cho Nhân viên
├── providers/               # Hợp nhất Provider toàn cục (AppProviders.tsx)
├── routes/                  # Định tuyến React Router DOM và Route Guards (RBAC)
├── types/                   # Định nghĩa TypeScript Types & DTOs
└── utils/                   # Tiện ích bổ trợ (formatters, dateUtils, timeUtils)
```

---

## 8. Tích hợp Backend

### 1. Cấu hình Gọi API & CORS
* **Cơ chế Cookie:** Mọi yêu cầu HTTP qua Axios đều được cấu hình `withCredentials: true` để trình duyệt tự động đính kèm HttpOnly Cookie xác thực phiên làm việc.
* **Vite Proxy:** Trong `vite.config.ts`, tiền tố `/api` được cấu hình proxy tự động chuyển tiếp tới Backend (`http://localhost:3000`), giúp loại bỏ hoàn toàn lỗi CORS khi phát triển cục bộ:
  ```ts
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  }
  ```

### 2. Quản lý Cache với TanStack Query v5
* Mọi thao tác lấy dữ liệu đều được quản lý cache thông minh theo các Query Key chuẩn hóa (ví dụ: `['employees']`, `['attendance']`, `['shifts']`).
* Khi người dùng thực hiện cập nhật (Mutation), hàm `queryClient.invalidateQueries` sẽ tự động được kích hoạt để làm mới dữ liệu trên bảng ngay lập tức mà không cần tải lại toàn trang.

### 3. Đồng bộ Thời gian thực qua Socket.IO
* Hook `useAttendanceSocket` tự động kết nối tới namespace của Backend.
* Khi có sự kiện quẹt thẻ mới được nhận diện tại cổng, Socket Gateway sẽ phát tín hiệu và Frontend tự động cập nhật bảng công và Live Feed ngay tức thì.

---

## 9. Build và Troubleshooting

1. **Lỗi kiểm tra kiểu TypeScript (`npx tsc --noEmit` báo lỗi):**
   * *Khắc phục:* Chạy `npm run lint` để định vị chính xác vị trí lỗi kiểu dữ liệu và sửa chữa trước khi chạy lệnh `npm run build`.
2. **Không gọi được API Backend (Lỗi `Network Error` hoặc `401 Unauthorized`):**
   * *Khắc phục:* 
     - Đảm bảo Backend đang chạy ổn định tại cổng 3000 (`http://localhost:3000/health`).
     - Nếu nhận mã lỗi 401, phiên đăng nhập có thể đã hết hạn, vui lòng đăng nhập lại để nhận cookie mới.
3. **Lỗi không xem được Video WebRTC từ Edge AI Camera:**
   * *Khắc phục:* Kiểm tra xem dịch vụ MediaMTX / Camera streaming đã khởi động chưa và URL WHEP trong cấu hình thiết bị có khả dụng hay không.
4. **Sự kiện chấm công không tự động nhảy trên bảng:**
   * *Khắc phục:* Kiểm tra biến `VITE_SOCKET_URL` trong file `.env` đã trỏ đúng về `http://localhost:3000` chưa và biểu tượng kết nối trên thanh Topbar có hiển thị màu xanh không.
