# 🎨 SmartFace Frontend — React 19 + Vite + Tailwind CSS v4 + TanStack Query v5

> **SmartFace Frontend** là ứng dụng Web Quản trị và Cổng tự phục vụ dành cho Hệ thống SmartFace AIoT. Được xây dựng trên nền tảng **React 19**, **Vite**, **TypeScript**, **TanStack Query v5**, **Tailwind CSS v4** cùng giao diện thiết kế hiện đại **Glassmorphism & Dark Mode**.

---

## 🛠 Tech Stack Chi Tiết

| Thư viện / Công nghệ | Phiên bản | Mục đích & Ứng dụng |
| :--- | :---: | :--- |
| **React** | `v19.0` | Thư viện giao diện chính, render UI mượt mà |
| **Vite** | `v6.2` | Công cụ Build tool siêu tốc & Development Server |
| **TypeScript** | `v5.8` | Kiểm tra kiểu dữ liệu tĩnh nghiêm ngặt & loại bỏ hoàn toàn `any` |
| **TanStack Query** | `v5.67` | Quản lý Async State, Server Cache, Invalidation & Automatic Retry |
| **Tailwind CSS** | `v4.1` | Styling Framework thế hệ mới cho giao diện Glassmorphism |
| **React Router DOM** | `v7.18` | Định tuyến Client-side routing, hỗ trợ Protected Routes & Layouts |
| **Recharts** | `v3.10` | Biểu đồ trực quan hóa chi phí lương & tỷ lệ đi làm theo tuần từ DB |
| **Lucide React** | `v0.546` | Bộ icon chuẩn UI/UX sắc nét |
| **Socket.IO Client** | `v4.8` | Nhận tín hiệu chấm công và cập nhật Dashboard thời gian thực |

---

## 📋 Yêu Cầu Tiên Quyết (Prerequisites)

- **Node.js**: `≥ 20.0.0`
- **Backend Service**: Đã khởi chạy thành công tại địa chỉ `http://localhost:3000`

---

## 🚀 Hướng Dẫn Khởi Chạy

### 🟢 Cách 1: Sử dụng Script Tự Động (`run.bat` tại thư mục gốc dự án)

Mở Terminal tại thư mục gốc `SmartFace-AIoT-Based-Staff-Management-Attendance-System/` và chọn tùy chọn:
- Select `[1]`: Chạy toàn bộ (Docker DB + Backend + Frontend).
- Select `[4]`: Chỉ chạy riêng Web Frontend (`http://localhost:5173`).

---

### 🟡 Cách 2: Thực Hiện Thủ Công (Manual Setup)

#### Bước 1: Truy cập thư mục & cài đặt dependencies
```bash
cd frontend
npm install
```

#### Bước 2: Tạo file biến môi trường
Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

#### Bước 3: Khởi chạy Vite Dev Server
```bash
npm run dev
# Truy cập giao diện ứng dụng tại: http://localhost:5173
```

#### Bước 4: Đóng gói sản phẩm (Production Build)
```bash
# Biên dịch mã nguồn & đóng gói vào thư mục dist/
npm run build

# Xem thử bản đóng gói sản phẩm
npm run preview
```

---

## 🔑 Biến Môi Trường (Environment Variables)

Danh sách biến môi trường trong file `frontend/.env`:

| Tên biến | Mô tả chức năng | Giá trị mặc định | Bắt buộc? |
| :--- | :--- | :--- | :---: |
| `VITE_API_BASE` | Đường dẫn API gốc (Để rỗng sẽ dùng Proxy `/api` của Vite) | `""` | 🟠 Tùy chọn |
| `VITE_SOCKET_URL` | Địa chỉ kết nối Server Socket.IO Real-time | `http://localhost:3000` | 🔴 Có |

---

## 📜 Available NPM Scripts

| Lệnh Script | Mô tả chi tiết |
| :--- | :--- |
| `npm run dev` | Khởi chạy Vite Dev Server tại địa chỉ `http://localhost:5173` |
| `npm run build` | Biên dịch TypeScript & đóng gói tài nguyên tối ưu cho Production vào thư mục `dist/` |
| `npm run preview` | Khởi chạy Server xem trước sản phẩm sau khi build |
| `npm run lint` | Kiểm tra lỗi Type-checking nghiêm ngặt (`tsc --noEmit`) |

---

## 📁 Cấu Trúc Thư Mục Frontend

```text
frontend/
├── public/                 # Tài nguyên tĩnh (Favicon, logo, hình ảnh)
├── src/
│   ├── main.tsx            # Entry point chính của ứng dụng React & QueryClientProvider
│   ├── App.tsx             # Định tuyến Router & Cấu hình phân luồng Layout
│   ├── index.css           # Custom styles, Glassmorphism, Theme & Tailwind setup
│   ├── api/                # API Client Layer (axios/fetch credentials, HttpOnly auth)
│   ├── components/         # Các Reusable UI Components
│   │   ├── common/         # Component dùng chung (Toast, Badge, Modal, StatCard)
│   │   └── layout/         # Header, Topbar, Sidebar, AppLayout
│   ├── context/            # Modular Global State Management (AuthContext & ToastContext)
│   ├── features/           # Feature Modules (Biển diễn mô hình Feature-based)
│   │   └── attendance-monitor/ # Feature giám sát chấm công, khóa ca & xuất báo cáo CSV
│   ├── hooks/              # Domain-specific React Query Hooks (useEmployees, useShifts, useAttendance, usePayroll)
│   ├── pages/              # Màn hình chức năng ứng dụng
│   │   ├── public/         # LandingPage, LoginPage
│   │   ├── manager/        # Manager Dashboard, Employee Manager, Schedule, Attendance, Payroll, Reports...
│   │   └── staff/          # Staff Dashboard, Personal Attendance, Profile, Schedule, SalaryEstimate...
│   ├── types/              # Interfaces & TypeScript Definitions chuẩn hóa
│   └── utils/              # Helper functions (getTodayVNString, formatVNDateISO, Currency, Socket client)
├── index.html              # HTML Template entry point
├── vite.config.ts          # Cấu hình Vite Server, Port & Proxy API
├── package.json            # Thư viện & Scripts
└── tsconfig.json           # Cấu hình compiler TypeScript
```

---

## 💻 Kiến Trúc Quản Lý Trạng Thái & Trải Nghiệm Người Dùng (Architecture & UI Highlights)

- ⚡ **TanStack Query v5 Cache Management**: Thay thế mô hình God Object cũ bằng các Custom Hooks tách biệt theo domain (`useEmployees`, `useShifts`, `useAttendance`, `usePayroll`). Tự động revalidate và hủy bỏ cache an toàn khi người dùng Đăng xuất/Đăng nhập (`queryClient.clear()`).
- 🔐 **Bảo Mật Xác Thực**: Lưu giữ Token trong HttpOnly Cookie từ Backend, khóa tính năng chuyển vai trò `switchRole` chỉ cho phép trong môi trường Development (`import.meta.env.DEV`).
- 🌐 **Xử Lý Múi Giờ Chuẩn Vietnam (+07:00)**: Hàm `getTodayVNString()` và `formatVNDateISO()` sử dụng `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })` đảm bảo chuỗi ngày `YYYY-MM-DD` luôn chính xác theo giờ Việt Nam.
- 📊 **Thống Kê Dữ Liệu Thực Tế**: Biểu đồ Recharts trong `ManagerReports.tsx` lấy dữ liệu trực tiếp từ bảng lương và lịch sử chấm công 4 tuần gần nhất. Khi CSDL trống, hệ thống hiển thị trạng thái "Chưa có dữ liệu" rõ ràng.
- 🎨 **Phong Cách Glassmorphism & Dark Mode**: Thiết kế giao diện hiện đại, mượt mà với hiệu ứng mờ nhòe kính (backdrop-blur) và tông màu tối sang trọng.
- 📱 **Responsive Hoàn Hảo**: Tương thích mượt mà trên màn hình máy tính bàn, laptop và thiết bị di động.

---

## 📄 License & Thông Tin

Dự án được phân phối theo giấy phép MIT. Xem thêm chi tiết tại file [LICENSE](../LICENSE).
