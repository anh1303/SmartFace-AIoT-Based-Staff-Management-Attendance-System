# SmartFace Frontend

Ứng dụng React và TypeScript cho quản trị viên, quản lý và nhân viên. Giao diện dùng Vite, Tailwind CSS, React Router, TanStack Query và Socket.IO.

## Cài đặt

Cần Node.js và npm; Dockerfile của dự án dùng Node.js 22. Từ thư mục gốc:

```sh
cd frontend
npm ci
```

Sao chép [.env.example](.env.example) thành `.env` bằng `cp` hoặc `Copy-Item`, rồi sửa cấu hình nếu cần.

## Cấu hình

| Biến | Ý nghĩa |
| --- | --- |
| `VITE_API_BASE` | Gốc URL API; để trống để dùng `/api` cùng origin |
| `VITE_SOCKET_URL` | URL Socket.IO; để trống khi dùng reverse proxy cùng origin |
| `VITE_DEMO_MODE` | Dữ liệu demo; đặt `false` khi dùng backend thật |
| `VITE_IOT_HARDWARE_ENABLED` | Đặt `false` để ẩn giao diện phần cứng; mặc định bật |
| `VITE_MEDIAMTX_WHEP_URL` | URL WHEP tùy chọn; để trống để chọn theo HTTP/HTTPS hiện tại |

Vite đóng gói biến `VITE_*` khi build. Không đặt secret trong các biến này. Thay `.env` sau khi build không cập nhật bundle đã triển khai; cần build lại với cấu hình tương ứng.

## Chạy ứng dụng

Các lệnh sau chạy tại `frontend/`:

```sh
npm run dev
```

Mở `http://localhost:5173`. Vite chuyển tiếp `/api` và `/socket.io` tới `http://127.0.0.1:3000` theo [vite.config.ts](vite.config.ts). Nếu truy cập trực tiếp backend từ trình duyệt, cấu hình CORS/cookie phải khớp origin frontend.

```sh
npm run lint
npm run build
npm run preview
```

`lint` hiện là kiểm tra TypeScript (`tsc --noEmit`), không phải ESLint. `preview` để xem bản build tại máy; triển khai dùng Docker/Nginx hoặc reverse proxy tương ứng.

## Cấu trúc

- `src/features/`: tính năng và public entry point.
- `src/pages/`: trang quản trị, nhân viên và khách.
- `src/components/`: thành phần giao diện chung.
- `src/routes/`: định tuyến và route guard.
- `src/providers/`, `src/context/`: provider/context.
- `src/config/`, `src/api/`, `src/utils/`: cấu hình, API và tiện ích.

Backend vẫn kiểm tra quyền cho mỗi thao tác; route guard phục vụ điều hướng. Camera WebRTC cần MediaMTX và cấu hình thiết bị phù hợp.

## Kiểm tra

```sh
npm test -- --no-file-parallelism
```

Lệnh chạy các test còn giữ trong `src/` và `validation/`. Không sử dụng số lượng test của đợt trước làm tiêu chí hiện tại. `validation/integration/payroll-cache.test.tsx` từng báo lỗi không ổn định theo thời gian; nếu lỗi xuất hiện, giữ kết quả để điều tra thay vì coi là đã pass.

Xem [Backend](../backend/README.md) và [tài liệu triển khai](../docs/README.md).
