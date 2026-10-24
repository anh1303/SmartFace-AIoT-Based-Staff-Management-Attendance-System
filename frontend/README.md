# 🎨 SmartFace Frontend — React 19 + Vite + Tailwind CSS v4

> **SmartFace Frontend** là ứng dụng Web Quản trị Trung tâm (Admin / Manager Portal) và Cổng Tự Phục Vụ Nhân viên (Employee Self-Service Portal) thuộc Hệ sinh thái Quản lý Nhân sự & Chấm công Thông minh SmartFace AIoT.  
> Được xây dựng trên nền tảng **React 19**, **Vite (v6.2)**, **TypeScript (v5.8)**, **TanStack React Query v5** và **Tailwind CSS v4** với ngôn ngữ thiết kế **Glassmorphism & Dark Mode** hiện đại, ứng dụng kết nối dữ liệu thời gian thực qua **Socket.IO** và tích hợp trình phát video độ trễ thấp **WebRTC** trực tiếp từ Edge AI Camera.

---

## 🛠 Tech Stack

| Thư viện / Công nghệ | Phiên bản | Vai trò & Mục đích sử dụng |
| :--- | :---: | :--- |
| **React** | `v19.0` | Thư viện UI cốt lõi, tận dụng tính năng kết xuất đồng thời (Concurrent Features) |
| **Vite** | `v6.2` | Build tool và Dev Server với cơ chế HMR (Hot Module Replacement) tốc độ cao |
| **TypeScript** | `v5.8` | Kiểm tra kiểu tĩnh nghiêm ngặt toàn bộ State, Props, DTOs và API Client |
| **TanStack Query** | `v5.103` | Quản lý Server State: Caching thông minh, Background Revalidation & Query Invalidation |
| **Tailwind CSS** | `v4.1` | Styling Framework thế hệ mới, tối ưu hóa CSS build qua `@tailwindcss/vite` |
| **React Router DOM** | `v7.18` | Định tuyến Client-side và bảo vệ luồng truy cập với Protected Route Guards |
| **Recharts** | `v3.10` | Trực quan hóa dữ liệu biểu đồ phân tích chấm công và xu hướng chi phí lương |
| **Lucide React** | `v0.546` | Bộ biểu tượng SVG vector chuẩn hóa giao diện người dùng |
| **Socket.IO Client** | `v4.8` | Kết nối WebSocket nhận thông báo chấm công và trạng thái thiết bị thời gian thực |

---

## 🏛️ Kiến Trúc Ứng Dụng (Feature-Driven Architecture)

Dự án được cấu trúc theo mô hình **Pragmatic Feature-Driven**, phân tách ranh giới rõ ràng giữa **Tầng dùng chung (Cross-Cutting Shared Layer)** và **Tầng nghiệp vụ (Domain Features)**, đồng thời giữ các trang (Pages) ở trạng thái tinh gọn chỉ đóng vai trò điều phối layout:

```text
frontend/src/
├── api/                    # HTTP Client Layer (Axios instance, cấu hình HttpOnly credentials)
├── components/             # Reusable UI Primitives (Tầng giao diện độc lập nghiệp vụ)
│   ├── common/             # UI Components dùng chung (Table, Modal, Drawer, Toast, Search, Filter)
│   └── layout/             # Khung sườn giao diện chính (AppLayout, Sidebar, Topbar)
├── config/                 # Cấu hình kết nối, Socket URLs và các hằng số hệ thống
├── context/                # Client Global State (AuthContext, ThemeContext, ToastContext, AppContext)
├── features/               # 6 Bounded Feature Modules (Trọng tâm nghiệp vụ)
│   ├── attendances/        # Giám sát chấm công, bảng theo dõi, chốt ca, bộ lọc, Live Feed & WebRTC Camera
│   ├── biometrics/         # Đăng ký nhận diện khuôn mặt, Camera eKYC, quản lý vector ArcFace
│   ├── employees/          # Quản lý nhân sự, hồ sơ chi tiết đa tabs, quản lý phòng ban & chức vụ
│   ├── payrolls/           # Quản lý bảng lương theo kỳ, cấu hình thưởng/phạt, chốt sổ bảng lương
│   ├── reports/            # Báo cáo thống kê, trực quan hóa biểu đồ xu hướng công và chi phí lương
│   └── schedules/          # Lịch làm việc, ma trận phân ca theo tuần/tháng, phân ca hàng loạt
├── hooks/                  # Shared custom hooks tích hợp TanStack React Query v5
├── lib/                    # Cấu hình các thư viện bên thứ ba (QueryClient singleton)
├── pages/                  # Thin Route Coordinators (Điều phối Feature Components vào Layout)
│   ├── public/             # LandingPage, LoginPage
│   ├── manager/            # Manager Dashboard, Employee List/Detail, Attendance Monitor, Schedule, Payroll...
│   └── employee/           # Employee Dashboard, Attendance History, Schedule, Salary Estimate/History...
├── providers/              # Hợp nhất cây Context Providers (AppProviders.tsx)
├── routes/                 # Hệ thống định tuyến và Protected Route Guards phân quyền RBAC
├── types/                  # Shared TypeScript Definitions, DTOs và Domain Models
└── utils/                  # Tiện ích bổ trợ (dateUtils, formatters, logger, timeUtils)
```

---

## ⚡ Chiến Lược Quản Lý Trạng Thái (State Management)

Hệ thống phân định rõ ràng giữa hai tầng trạng thái chính:

### 1. Server Cache State (TanStack Query v5)
Toàn bộ dữ liệu bất đồng bộ từ máy chủ được quản lý thông qua TanStack Query với các quy chuẩn:
- **Tối ưu hóa tài nguyên mạng**: Tự động lưu cache, loại bỏ các yêu cầu trùng lặp (*Request Deduplication*) và tự động làm mới ngầm khi cửa sổ được kích hoạt lại.
- **Quy chuẩn Query Keys**:
  - `['employees']`, `['employees', id]`
  - `['departments']`, `['positions']`
  - `['attendance', { date, departmentId }]`
  - `['attendance-summaries', { month, year, employeeId }]`
  - `['shifts', { month, year }]`
  - `['payroll', { period }]`
- **Bảo Vệ Dữ Liệu Khi Đăng Xuất**:  
  Khi người dùng đăng xuất hoặc phiên làm việc chấm dứt, hàm `logout()` sẽ thực thi `queryClient.clear()` nhằm xóa sạch toàn bộ dữ liệu nhạy cảm khỏi bộ nhớ trình duyệt, ngăn chặn nguy cơ rò rỉ thông tin.

### 2. Client Global State (React Context Layer)
- **`AuthContext`**: Quản lý trạng thái phiên làm việc (xác thực qua HttpOnly Cookie), thông tin người dùng hiện tại và các helper phân quyền (`isAdmin`, `isManager`).
- **`ThemeContext`**: Quản lý chế độ hiển thị Dark/Light mode, lưu cấu hình vào `localStorage` và đồng bộ class `.dark` trên thẻ gốc `<html>`.
- **`ToastContext`**: Hệ thống thông báo toast toàn cục hỗ trợ hiển thị các trạng thái thành công, cảnh báo và lỗi.
- **`AppProviders`**: Đóng gói toàn bộ cây Provider vào một điểm duy nhất, giữ cho `main.tsx` và `App.tsx` luôn trong sáng và dễ bảo trì.

---

## 🛡️ Hệ Thống Phân Quyền & Phân Hệ Giao Diện (RBAC)

Ứng dụng chia tách phân luồng rõ rệt giữa hai phân hệ người dùng:

### 1. Cổng Quản Trị — Manager Portal (`/manager/*`)
Dành cho người dùng có vai trò `ADMIN` hoặc `MANAGER`, bảo vệ bởi `ManagerGuard`:
- **Dashboard Tổng Quan**: Theo dõi tỷ lệ đi làm hôm nay, biểu đồ nhân sự và cảnh báo thiết bị.
- **Quản Lý Nhân Sự**: Danh sách nhân viên, bộ lọc nâng cao, quản lý phòng ban và chức vụ qua Drawer.
- **Chi Tiết Hồ Sơ Nhân Viên**: Giao diện chi tiết đa tab (Thông tin cá nhân, Lịch làm việc, Lịch sử chấm công, Bảng lương, Dữ liệu sinh trắc học).
- **Giám Sát Chấm Công & Camera**: Bảng theo dõi quẹt thẻ thời gian thực, Live Event Feed và màn hình phát video trực tiếp qua WebRTC từ Edge Camera.
- **Ma Trận Phân Ca**: Bảng phân ca làm việc trực quan theo tuần và tháng, hỗ trợ gán ca hàng loạt cho phòng ban.
- **Quản Lý Tính Lương**: Tự động tính lương tháng từ dữ liệu chấm công, điều chỉnh thưởng/phạt và chốt sổ kỳ lương.
- **Sinh Trắc Học & eKYC**: Chụp ảnh trực tiếp từ camera để đăng ký vector nhận diện khuôn mặt Centroid.
- **Báo Cáo & Phân Tích**: Trực quan hóa xu hướng giờ làm việc và cơ cấu chi phí lương qua Recharts.

### 2. Cổng Tự Phục Vụ — Employee Portal (`/employee/*`)
Dành cho nhân viên thông thường, bảo vệ bởi `EmployeeGuard`:
- **Dashboard Cá Nhân**: Xem nhanh ca làm hôm nay, trạng thái chấm công và giờ công tích lũy trong tháng.
- **Lịch Sử Chấm Công**: Tra cứu toàn bộ các lần quẹt thẻ Check-in / Check-out và trạng thái công ngày.
- **Lịch Ca Làm Việc**: Xem lịch phân ca của bản thân theo tuần và tháng.
- **Dự Toán Lương**: Ước tính mức thu nhập thực tế trong tháng dựa trên tổng giờ làm và hệ số lương.
- **Lịch Sử Phiếu Lương**: Tra cứu các phiếu lương đã được ban quản lý chốt sổ qua từng kỳ.
- **Hồ Sơ Cá Nhân**: Xem thông tin tài khoản và cập nhật mật khẩu.

---

## 📡 Tích Hợp Real-time & Truyền Phát Video

### 1. Socket.IO Real-time Client
Hệ thống kết nối tới hai namespaces chuyên biệt trên Backend:
- **Namespace `/attendance`**: Lắng nghe sự kiện `checked-in` và `checked-out` tức thời để hiển thị thẻ thông báo trên `LiveEventFeed` và cập nhật biểu đồ thống kê mà không cần tải lại trang.
- **Namespace `/devices`**: Lắng nghe sự kiện đổi chế độ thiết bị (`mode-changed`) và trạng thái nhịp tim (`status: ONLINE / OFFLINE`).

### 2. WebRTC Live Camera Streaming
Tích hợp trình phát video độ trễ thấp (*Ultra Low Latency*) qua chuẩn WebRTC kết nối với camera giám sát AIoT, cho phép người quản lý theo dõi trực tiếp khu vực cửa ra vào ngay trên màn hình Giám sát chấm công.

---

## 🔑 Biến Môi Trường (`.env`)

Tạo file `.env` tại thư mục gốc `frontend/` để cấu hình kết nối tới Backend:

```env
# Địa chỉ gốc của REST API (để trống để sử dụng tính năng Proxy /api của Vite)
VITE_API_BASE=""

# Địa chỉ máy chủ Socket.IO Backend
VITE_SOCKET_URL="http://localhost:3000"
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu Cầu Tiên Quyết
- **Node.js**: Phiên bản $\ge 20.0.0$
- **NPM**: Đi kèm với Node.js

### 2. Cài Đặt Thư Viện
```bash
cd frontend
npm install
```

### 3. Cấu Hình Biến Môi Trường
Sao chép file mẫu và cấu hình:
```bash
cp .env.example .env
```

### 4. Khởi Chạy Môi Trường Phát Triển
```bash
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:5173`

### 5. Kiểm Tra Kiểu Dữ Liệu & Đóng Gói Production
```bash
# Kiểm tra lỗi kiểu tĩnh TypeScript
npm run lint

# Biên dịch và tối ưu hóa tài nguyên cho môi trường Production
npm run build

# Xem trước kết quả bản đóng gói Production
npm run preview
```

---

## 📜 Danh Sách Lệnh NPM Scripts

| Lệnh Script | Mô tả chức năng |
| :--- | :--- |
| `npm run dev` | Khởi chạy Vite Dev Server tại `http://localhost:5173` |
| `npm run build` | Biên dịch TypeScript và đóng gói tài nguyên vào thư mục `dist/` |
| `npm run preview` | Khởi chạy máy chủ cục bộ để xem trước bản build production |
| `npm run lint` | Kiểm tra lỗi type checking toàn bộ dự án (`tsc --noEmit`) |
| `npm run test` | Thực thi kiểm thử tự động với Vitest |
