# 🎨 SmartFace Frontend — React 19 + Vite + Tailwind CSS v4

> **SmartFace Frontend** là ứng dụng Web Quản trị và Cổng tự phục vụ dành cho Hệ thống SmartFace AIoT. Được xây dựng trên nền tảng **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4** cùng giao diện thiết kế hiện đại **Glassmorphism & Dark Mode**.

---

## 🛠 Tech Stack Chi Tiết

| Thư viện / Công nghệ | Phiên bản | Mục đích & Ứng dụng |
| :--- | :---: | :--- |
| **React** | `v19.0` | Thư viện giao diện chính, render UI mượt mà |
| **Vite** | `v6.2` | Công cụ Build tool siêu tốc & Development Server |
| **TypeScript** | `v5.8` | Kiểm tra kiểu dữ liệu tĩnh nghiêm ngặt & tự động gợi ý code |
| **Tailwind CSS** | `v4.1` | Styling Framework thế hệ mới cho giao diện Glassmorphism |
| **React Router DOM** | `v7.18` | Định tuyến Client-side routing, hỗ trợ Protected Routes & Layouts |
| **Recharts** | `v3.10` | Biểu đồ trực quan hóa dữ liệu chấm công, tỉ lệ đi làm & lương |
| **Lucide React** | `v0.546` | Bộ icon chuẩn UI/UX sắc nét |
| **Socket.IO Client** | `v4.8` | Nhận tín hiệu chấm công và cập nhật Dashboard thời gian thực |

---

## 📋 Yêu Cầu Tiên Quyết (Prerequisites)

- **Node.js**: `≥ 20.0.0`
- **Backend Service**: Đã khởi chạy thành công tại địa chỉ `http://localhost:3000`

---

## 🚀 Hướng Dẫn Khởi Chạy

### 🟢 Cách 1: Sử dụng Script Tự Động (`run.bat` tại thư mục gốc)

Bạn có thể mở file `run.bat` ở thư mục gốc dự án và chọn các tùy chọn:
- Choose `[1]`: Chạy toàn bộ (Docker DB + Backend + Frontend).
- Choose `[4]`: Chỉ chạy riêng Web Frontend (`http://localhost:5173`).

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
│   ├── main.tsx            # Entry point chính của ứng dụng React
│   ├── App.tsx             # Định tuyến Router & Cấu hình phân luồng Layout
│   ├── index.css           # Custom styles, Glassmorphism, Theme & Tailwind setup
│   ├── components/         # Các Reusable UI Components
│   │   ├── common/         # Component dùng chung (Toast, Badge, Modal, StatCard)
│   │   └── layout/         # Header, Topbar, Sidebar, AppLayout
│   ├── context/            # Global State Management (AppContext & Authentication)
│   ├── pages/              # Màn hình chức năng ứng dụng
│   │   ├── public/         # LandingPage, LoginPage
│   │   ├── manager/        # Manager Dashboard, Employee Manager, Schedule, Attendance, Payroll...
│   │   └── staff/          # Staff Dashboard, Personal Attendance, Profile, Salary...
│   ├── types/              # Interfaces & TypeScript Definitions
│   └── utils/              # Helper functions (Date format, Currency, Socket client)
├── index.html              # HTML Template entry point
├── vite.config.ts          # Cấu hình Vite Server, Port & Proxy API
├── package.json            # Thư viện & Scripts
└── tsconfig.json           # Cấu hình compiler TypeScript
```

---

## 💻 Giao Diện & Trải Nghiệm Người Dùng (UI/UX Highlights)

- 🎨 **Phong Cách Glassmorphism & Dark Mode**: Thiết kế giao diện hiện đại, chuyên nghiệp với hiệu ứng mờ nhòe kính (backdrop-blur) và tông màu tối sang trọng.
- 📊 **Dashboard Trực Quan Hoạ Số Liệu**: Sử dụng Recharts để hiển thị biểu đồ tròn tỉ lệ đi làm, biểu đồ cột chấm công tuần/tháng và thống kê thu nhập.
- ⚡ **Cập Nhật Real-time Bằng Socket.IO**: Màn hình quản lý nhận thông báo nổi (Toast Notification) tức thì khi có nhân viên điểm danh thành công tại thiết bị.
- 📱 **Responsive Hoàn Hảo**: Tương thích tốt trên màn hình máy tính bàn, laptop và thiết bị di động.

---

## 📄 License & Thông Tin

Dự án được phân phối theo giấy phép MIT. Xem thêm chi tiết tại file [LICENSE](../LICENSE).
